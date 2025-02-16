import { useMatomo } from "@jonkoops/matomo-tracker-react";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { CircularProgress, LinearProgress, Link } from "@mui/material";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell, { tableCellClasses } from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import React from "react";
import { useFormContext } from "../context/FormContext";
import { getStreamedData } from "../services/httpCalls";
import { ComparisonTableInterfaceRow } from "../types";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

interface StyledTableRowProps {
  highlight: boolean;
}

const StyledTableRow = styled(TableRow)<StyledTableRowProps>(
  ({ theme, highlight }) => ({
    backgroundColor: highlight ? theme.palette.primary.light : "inherit",
  })
);

export function ComparisonTable() {
  const { formState } = useFormContext();
  const { trackEvent } = useMatomo();

  const [rowSummaries, setRowSummaries] = React.useState<
    ComparisonTableInterfaceRow[]
  >([]);
  const [eventSource, setEventSource] = React.useState<EventSource | null>(
    null
  );

  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const fetchData = async () => {
      if (!formState.requestId) {
        setRowSummaries([]);
        if (eventSource) {
          eventSource.close();
          setEventSource(null);
        }
        return;
      }

      setLoading(true);

      try {
        const url = await getStreamedData({
          requestId: formState.requestId,
          start: formState.dateRange[0],
          end: formState.dateRange[1],
          powerClass: formState.powerClass,
        });

        if (eventSource) {
          eventSource.close();
        }

        const newEventSource = new EventSource(url);
        setEventSource(newEventSource);

        newEventSource.onmessage = (event) => {
          try {
            const jsonData = JSON.parse(event.data);
            setRowSummaries((prevSummaries) => [
              ...prevSummaries,
              jsonData.comparisonRow,
            ]);
          } catch (jsonError) {
            // eslint-disable-next-line no-console
            console.error("Error parsing JSON:", jsonError, event.data);
            alert("Error parsing JSON"); // Set error state
            newEventSource.close();
            setEventSource(null);
          }
        };

        newEventSource.onerror = () => {
          newEventSource.close();
          setEventSource(null);
          setLoading(false);
        };
      } catch (error) {
        alert("Error fetching data"); // Set error state
        setLoading(false); // Stop loading on fetch error
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentOfferTotal =
    rowSummaries.find(
      (row) =>
        row.offerType === formState.offerType &&
        row.optionKey === formState.optionType
    )?.total ?? 0;

  const getColorForPercentage = (percentage: number) => {
    if (percentage === 0) {
      return "inherit";
    }
    if (percentage >= 0) {
      return "red";
    } else {
      return "green";
    }
  };

  const startTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now();
    } else if (startTimeRef.current) {
      const loadTime = Date.now() - startTimeRef.current;

      trackEvent({
        category: "Performance",
        action: "Query Load Time",
        name: "ComparisonTable",
        value: Math.round(loadTime / 1000),
      });

      startTimeRef.current = null;
    }
  }, [loading, trackEvent]);

  return (
    <TableContainer component={Paper} sx={{ my: 3 }}>
      {formState.isGlobalLoading || !rowSummaries ? (
        <CircularProgress />
      ) : (
        <>
          <Table sx={{ minWidth: 700 }} aria-label="customized table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">Fournisseur </StyledTableCell>
                <StyledTableCell align="center">Offre</StyledTableCell>
                <StyledTableCell align="center">Option</StyledTableCell>
                <StyledTableCell align="center">
                  Abonnements (€)
                </StyledTableCell>
                <StyledTableCell align="center">
                  Coût de votre consommation (€)
                </StyledTableCell>
                <StyledTableCell align="center">
                  Total simulé (sans taxes, €)
                </StyledTableCell>
                <StyledTableCell align="center">
                  % de différence
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rowSummaries
                .sort((a, b) => {
                  return a.total - b.total;
                })
                .map((row) => (
                  <StyledTableRow
                    key={`${row.provider}-${row.offerType}-${row.optionKey}`}
                    highlight={
                      row.offerType === formState.offerType &&
                      row.optionKey === formState.optionType
                    }
                  >
                    <StyledTableCell align="center">
                      <img
                        src={`/${row.provider}.png`}
                        alt={row.provider}
                        width="24"
                        height="24"
                      />{" "}
                      {row.provider}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.offerType}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.optionName}{" "}
                      {row.overridingHpHcKey && (
                        <AccessTimeFilledIcon
                          sx={{
                            fontSize: "1rem",
                            verticalAlign: "middle",
                            color: "orange",
                          }}
                        />
                      )}
                      <Link
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="none"
                      >
                        <OpenInNewIcon sx={{ fontSize: "1rem" }} />
                      </Link>
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.fullSubscriptionCost}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.totalConsumptionCost}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.total}
                    </StyledTableCell>
                    <StyledTableCell
                      align="center"
                      style={{
                        color: getColorForPercentage(
                          (100 * (row.total - currentOfferTotal)) / row.total
                        ),
                      }}
                    >
                      {Math.round(
                        (100 * (row.total - currentOfferTotal)) / row.total
                      ) > 0
                        ? "+"
                        : ""}
                      {Math.round(
                        (100 * (row.total - currentOfferTotal)) / row.total
                      )}{" "}
                      %
                    </StyledTableCell>
                  </StyledTableRow>
                ))}
            </TableBody>
          </Table>
          {loading && <LinearProgress />}
        </>
      )}
    </TableContainer>
  );
}
