import cors from "cors";
import { endOfDay, isWithinInterval, startOfDay } from "date-fns";
import express, { NextFunction, Request, Response } from "express";
import fs, { readFileSync } from "fs";
import multer from "multer";
import cron from "node-cron";
import path, { join } from "path";
import unzipper from "unzipper";
import { v4 as uuidv4 } from "uuid";
import { default as hpHcFile } from "../statics/hp_hc.json";
import { default as priceMappingFile } from "../statics/price_mapping.json";
import { calculateRowSummary } from "./calculators";
import {
  ConsumptionLoadCurveData,
  parseCsvToConsumptionLoadCurveData,
} from "./csvParser";
import { analyseHourByHourBySeason } from "./statistics";
import { HpHcSlot, Option, PowerClass, PriceMappingFile } from "./types";
import {
  fetchTempoData,
  findFirstAndLastDate,
  getHolidaysBetweenDates,
  openJsonFile,
  readFileAsString,
} from "./utils";

const app = express();
app.disable("x-powered-by");
const port = 10000;

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://comparateur-electricite.gaboflo.fr",
  ],
};
app.use(cors(corsOptions));
app.use(express.json());

const uploadRelativeDir = "./uploads";
export const assetsRelativeDir = "./assets";

const deleteFolderRecursive = (folderPath: string) => {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // Recursively delete subdirectory
        deleteFolderRecursive(currentPath);
      } else {
        // Delete file
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
};

const edfUploadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.file) {
    res.status(400).send("Aucun fichier n'a été chargé.");
    return;
  }
  const { start, end, requestId } = req.query;
  if (!start || !end || !requestId) {
    res.status(400).send("Paramètres de requête manquants");
    return;
  }
  const startNumber = Number(start);
  const endNumber = Number(end);
  const askedDateRange: [Date, Date] = [
    new Date(startNumber),
    new Date(endNumber),
  ];
  if (isNaN(startNumber) || isNaN(endNumber)) {
    res.status(400).send("Paramètres start ou end invalides");
    return;
  }
  const zipFilePath = req.file.path;
  try {
    const directory = await unzipper.Open.file(zipFilePath);
    const csvFile = directory.files.find(
      (file) =>
        file.path.startsWith("mes-puissances-atteintes-30min") &&
        file.path.endsWith(".csv")
    );
    if (!csvFile) {
      res.status(404).send("Fichier CSV introuvable dans le zip.");
      return;
    }
    const csvContent = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      csvFile
        .stream()
        .on("data", (chunk) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
        .on("error", reject);
    });
    const parsedData = parseCsvToConsumptionLoadCurveData(csvContent);
    const fullPath = path.join(
      uploadRelativeDir,
      String(requestId),
      "edf.json"
    );
    fs.writeFile(fullPath, JSON.stringify(parsedData), (err) => {
      if (err) {
        console.error("Erreur lors de l'écriture du fichier JSON :", err);
        res.status(500).send("Impossible de sauvegarder le JSON");
        return;
      }
      const dateRangeOfFile = findFirstAndLastDate(parsedData);
      const analyzedDateRange: [number, number] = [
        Math.max(dateRangeOfFile[0], askedDateRange[0].getTime()),
        Math.min(dateRangeOfFile[1], askedDateRange[1].getTime()),
      ];
      const seasonData = analyseHourByHourBySeason({
        data: parsedData,
        dateRange: analyzedDateRange,
      });
      const totalConsumption = seasonData.reduce(
        (acc, cur) => acc + cur.seasonTotalSum,
        0
      );
      res.send({
        seasonData,
        requestId,
        analyzedDateRange,
        totalConsumption,
      });
    });
  } catch (error) {
    console.error("Erreur lors de l'extraction du fichier zip :", error);
    res.status(500).send("Erreur lors de l'extraction du fichier zip.");
  } finally {
    fs.unlink(zipFilePath, (err) => {
      if (err) {
        console.error("Erreur lors de la suppression du fichier zip :", err);
      }
    });
  }
};

const upload = multer({
  dest: uploadRelativeDir,
  limits: { fileSize: 1 * 1024 * 1024 },
});
app.post("/uploadEdfFile", upload.single("file"), edfUploadHandler);

app.post("/uploadHpHcConfig", upload.single("file"), (req, res) => {
  const requestId = uuidv4();
  const uploadDir = path.join(uploadRelativeDir, requestId);
  fs.mkdirSync(uploadDir, { recursive: true });
  const hphcFilePath = path.join(uploadDir, "hphc.json");
  fs.writeFileSync(hphcFilePath, JSON.stringify(req.body.file));
  res.status(200).send({ requestId });
});

app.get(
  "/stream/:requestId",
  async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.params.requestId;
    const { start, end, powerClass } = req.query;
    if (!requestId || !start || !end || !powerClass) {
      res.status(400).send("Champs manquants");
      return;
    }
    const dateRange: [Date, Date] = [
      new Date(Number(start)),
      new Date(Number(end)),
    ];
    const typedPowerClass = Number(powerClass) as PowerClass;
    const typedPriceMappingFile = priceMappingFile as PriceMappingFile;
    const edfPath = path.join(
      uploadRelativeDir,
      requestId.toString(),
      "edf.json"
    );
    const hphcPath = path.join(
      uploadRelativeDir,
      requestId.toString(),
      "hphc.json"
    );
    let edfData: string;
    try {
      edfData = await readFileAsString(edfPath);
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier JSON :", error);
      res.status(500).send("Erreur lors de la lecture du fichier JSON");
      return;
    }
    let jsonEdfData: ConsumptionLoadCurveData[];
    try {
      jsonEdfData = JSON.parse(edfData);
    } catch (error) {
      console.error("Erreur lors de l'analyse du JSON :", error);
      res.status(500).send("Erreur lors de l'analyse du JSON");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const sendData = async (option: Option) => {
      let filteredData = jsonEdfData.filter((elt) =>
        isWithinInterval(elt.recordedAt, {
          start: startOfDay(dateRange[0]),
          end: endOfDay(dateRange[1]),
        })
      );
      try {
        const defaultHpHcData = (await openJsonFile(hphcPath)) as HpHcSlot[];
        const rowSummary = await calculateRowSummary({
          data: filteredData,
          dateRange,
          powerClass: typedPowerClass,
          optionKey: option.optionKey,
          offerType: option.offerType,
          optionName: option.optionName,
          provider: option.provider,
          link: option.link,
          hpHcData: defaultHpHcData,
          overridingHpHcKey: option.overridingHpHcKey,
        });
        res.write(`data: ${JSON.stringify({ comparisonRow: rowSummary })}\n\n`);
      } catch (error) {
        console.error("Erreur lors du calcul du résumé :", error);
        res.write(
          `data: ${JSON.stringify({ error: "Erreur lors du calcul" })}\n\n`
        );
      }
    };
    (async () => {
      for (const option of typedPriceMappingFile) {
        await new Promise<void>((resolve) =>
          setImmediate(() => {
            sendData(option)
              .then(resolve)
              .catch((err) => {
                console.error("Erreur lors de l'envoi des données :", err);
                resolve();
              });
          })
        );
      }
      res.end();
      deleteFolderRecursive(path.join(uploadRelativeDir, requestId));
    })();
  }
);

app.get("/availableOffers", (req: Request, res: Response) => {
  res.json(priceMappingFile);
});
app.get("/defaultHpHc", (req: Request, res: Response) => {
  res.json(hpHcFile);
});

const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
app.get("/version", (req: Request, res: Response) => {
  res.json({ version: packageJson.version });
});

app.listen(port, () => {
  console.info(`Le serveur fonctionne sur http://localhost:${port}`);
});

cron.schedule("10 */3 * * *", () => {
  (async () => {
    const firstDate = new Date("2020-01-01");
    const now = new Date();
    const holidays = getHolidaysBetweenDates([firstDate, now]);
    const holidayPath = path.join(assetsRelativeDir, "holidays.json");
    fs.writeFile(holidayPath, JSON.stringify(holidays), (err) => {
      if (err) {
        console.error(
          "Erreur lors de l'écriture du fichier holidays.json :",
          err
        );
      }
    });
    try {
      const tempoDates = await fetchTempoData();
      const tempoFilePath = path.join(assetsRelativeDir, "tempo.json");
      fs.writeFile(tempoFilePath, JSON.stringify(tempoDates), (err) => {
        if (err) {
          console.error(
            "Erreur lors de l'écriture du fichier tempo.json :",
            err
          );
        }
      });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données tempo :",
        error
      );
    }
  })().catch((err) => {
    console.error("Erreur dans la tâche cron :", err);
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Erreur non gérée :", err);
  res.status(500).send("Une erreur est survenue sur le serveur.");
});
