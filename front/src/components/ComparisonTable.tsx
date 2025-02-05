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
  const [rowSummaries, setRowSummaries] = React.useState<
    ComparisonTableInterfaceRow[]
  >([]);
  const [eventSource, setEventSource] = React.useState<EventSource | null>(
    null
  );

  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const fetchData = async () => {
      if (!formState.fileId) {
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
          fileId: formState.fileId,
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

  return (
    <TableContainer component={Paper} sx={{ my: 3 }}>
      {formState.isGlobalLoading || !rowSummaries ? (
        <CircularProgress />
      ) : (
        <>
          <Table sx={{ minWidth: 700 }} aria-label="customized table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">Fournisseur</StyledTableCell>
                <StyledTableCell align="center">Offre</StyledTableCell>
                <StyledTableCell align="center">Option</StyledTableCell>
                <StyledTableCell align="center">
                  Abonnement mensuel (€)
                </StyledTableCell>
                <StyledTableCell align="center">
                  Coût simulé de votre consommation (€)
                </StyledTableCell>
                <StyledTableCell align="center">
                  Total des abonnements & coûts de consommation (sans taxes, €)
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
                      {row.provider}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.offerType}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {row.optionName}{" "}
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
                      {row.monthlyCost}
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
