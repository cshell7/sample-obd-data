import React, { useState, useEffect } from "react";
import "./App.css";
import example from "./example.json";

const ONE_MEGABYTE = 1000000; // Bytes

function App() {
  const [error, setError] = useState();
  const handleSetError = (errorText) => {
    setError(errorText);
    console.error(errorText);
  };

  // Save submitted file to state
  const [files, setFiles] = useState("");
  const numberOfFiles = Object.keys(files || {}).length;
  const handleFileUpload = ({ target }) => {
    if (
      // Check file type
      !Object.values(target.files).every((value) => value.type === "text/csv")
    ) {
      handleSetError("File type is incorrect. Make sure it is a .csv file");
      setFiles("");
    } else if (
      // Check file size
      !Object.values(target.files).every(
        (value) => value.size < ONE_MEGABYTE * 10
      )
    ) {
      handleSetError("File is too large. 10MB max.");
      setFiles("");
    } else setFiles(target.files);
  };

  // Read and consolidate files
  const [sampleRate, setSampleRate] = useState(60);
  const [numberOfColumns, setNewNumberOfColumns] = useState();
  const [header, setHeader] = useState();
  const [rows, setRows] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isReading, setIsReading] = useState(false);
  useEffect(() => {
    if (!isReading && currentFileIndex < numberOfFiles) {
      setIsReading(true);
      const reader = new FileReader();
      reader.readAsText(files[currentFileIndex]);

      reader.onload = function () {
        const [newHeader, ...newRows] = reader.result.split("\n");
        const newNumberOfColumns = newHeader.split(",").length;
        if (!numberOfColumns || numberOfColumns === newNumberOfColumns) {
          if (!header) {
            setHeader(newHeader);
            setNewNumberOfColumns(newNumberOfColumns);
          }
          setRows([...rows, ...newRows]);
          setCurrentFileIndex(currentFileIndex + 1);
        } else {
          handleSetError(
            "Number of columns is not the same accross files. Please try again."
          );
        }
        setIsReading(false);
        setError("");
      };
    }
  }, [
    currentFileIndex,
    numberOfFiles,
    files,
    numberOfColumns,
    header,
    rows,
    isReading,
  ]);

  // Sample data
  const [haveFilesBeenSampled, setHaveFilesBeenSampled] = useState(false);
  useEffect(() => {
    if (
      numberOfFiles > 0 &&
      !haveFilesBeenSampled &&
      currentFileIndex === numberOfFiles
    ) {
      setRows(rows.filter((word, i) => i % sampleRate === 0));
      setHaveFilesBeenSampled(true);
    }
  }, [currentFileIndex, numberOfFiles, rows, sampleRate, haveFilesBeenSampled]);

  const [newFile, setNewFile] = useState();
  useEffect(() => {
    if (haveFilesBeenSampled) {
      setNewFile([header, ...rows].join("\n"));
    }
  }, [haveFilesBeenSampled, header, rows]);

  const [hasProcessedData, setHasProcessedData] = useState(false);
  useEffect(() => {
    if (haveFilesBeenSampled && !hasProcessedData) {
      setHeader(header.split(","));
      setRows(rows.map((row) => row.split(",")));
      setHasProcessedData(true);
    }
  }, [haveFilesBeenSampled, hasProcessedData, header, rows]);

  const [columns, setColumns] = useState();
  useEffect(() => {
    if (hasProcessedData && !columns) {
      setColumns(
        header.reduce((newObject, headerValue, index) => {
          const values = rows.map((row) => row[index]);
          const valuesThatAreInts = values.filter((value) =>
            Number.isInteger(parseInt(value))
          );
          return {
            ...newObject,
            [index]: {
              name: headerValue,
              values,
              max: Math.max(...valuesThatAreInts),
              min: Math.min(...valuesThatAreInts),
              avg:
                valuesThatAreInts.reduce(
                  (p, c) => parseInt(p) + parseInt(c),
                  0
                ) / valuesThatAreInts.length,
            },
          };
        }, {})
      );
    }
  }, [hasProcessedData, columns, header, rows]);

  const graphWidth = 800;
  const graphHeight = 400;

  const [selectedField, setSelectedField] = useState();

  const cachedValuesString = localStorage.getItem("savedOBDSample");
  const cachedValues = !!cachedValuesString && JSON.parse(cachedValuesString);

  const [useExample, setUseExample] = useState(false);
  const numberOfDataPoints = useExample
    ? example.there[0].values.length
    : rows?.length;

  const mainValue = useExample ? example.there : columns;
  const secondaryValue = useExample ? example.back : cachedValues;

  console.log(mainValue?.[selectedField]);
  return (
    <div className="App">
      <header className="App-header">
        <h1>OBD2 data sampler</h1>
        {!!error && <p>{error}</p>}
        <p>
          Sample rate: 1 out of every{" "}
          <input
            type="number"
            onChange={({ target }) => setSampleRate(target.value)}
            value={sampleRate}
          />
        </p>

        <input type="file" onChange={handleFileUpload} multiple accept=".csv" />
        {haveFilesBeenSampled && (
          <>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                columns
              )}`}
              style={{ color: "white", marginTop: "16px" }}
              download="headers.csv"
            >
              Download sampled data
            </a>
            <button
              onClick={() => {
                localStorage.setItem("savedOBDSample", JSON.stringify(columns));
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("savedOBDSample");
              }}
            >
              Clear Saved
            </button>
          </>
        )}
        <button
          onClick={() => {
            setUseExample(!useExample);
          }}
        >
          {useExample ? "use uploaded files" : "use example"}
        </button>
      </header>
      {mainValue && (
        <select
          onChange={({ target }) => setSelectedField(target.value)}
          value={selectedField || ""}
          style={{ margin: "16px auto", display: "block" }}
        >
          <option value=""></option>
          {Object.entries(mainValue)
            .filter(([key, { values }]) =>
              values.some((value) => Number.isInteger(parseInt(value)))
            )
            .map(([key, { name }]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
        </select>
      )}
      {!!selectedField && (
        <>
          <p>max: {mainValue[selectedField].max}</p>
          <p>avg: {mainValue[selectedField].avg}</p>
          <p>min: {mainValue[selectedField].min}</p>
        </>
      )}
      {!!selectedField && secondaryValue && (
        <>
          <p>cached max: {secondaryValue[selectedField].max}</p>
          <p>cached avg: {secondaryValue[selectedField].avg}</p>
          <p>cached min: {secondaryValue[selectedField].min}</p>
        </>
      )}
      <svg
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        width={graphWidth}
        height={graphHeight}
        class="chart"
        style={{
          border: "1px solid gray",
          marginTop: "16px",
          marginBottom: "32px",
        }}
      >
        {!!selectedField && (
          <>
            <polyline
              fill="none"
              stroke="blue"
              stroke-width="2"
              points={mainValue[selectedField].values
                .filter((value) => Number.isInteger(parseInt(value)))
                .map((value, index) => {
                  return `${Math.floor(
                    (graphWidth / numberOfDataPoints) * index
                  )},${
                    Number.isInteger(parseInt(value))
                      ? graphHeight -
                        Math.floor(
                          (graphHeight / 100) *
                            ((value / mainValue[selectedField].max) * 100)
                        )
                      : 0
                  }`;
                })
                .join(" ")}
            />
            <polyline
              fill="none"
              stroke="lightblue"
              stroke-width="2"
              points={`0,${
                graphHeight -
                Math.floor(
                  (graphHeight / 100) *
                    ((mainValue[selectedField].avg /
                      mainValue[selectedField].max) *
                      100)
                )
              } ${graphWidth},${
                graphHeight -
                Math.floor(
                  (graphHeight / 100) *
                    ((mainValue[selectedField].avg /
                      mainValue[selectedField].max) *
                      100)
                )
              }`}
            />
            {(!!cachedValues || useExample) && (
              <>
                <polyline
                  fill="none"
                  stroke="red"
                  stroke-width="2"
                  points={secondaryValue[selectedField].values
                    .filter((value) => Number.isInteger(parseInt(value)))
                    .map((value, index) => {
                      return `${Math.floor(
                        (graphWidth / numberOfDataPoints) * index
                      )},${
                        Number.isInteger(parseInt(value))
                          ? graphHeight -
                            Math.floor(
                              (graphHeight / 100) *
                                ((value / secondaryValue[selectedField].max) *
                                  100)
                            )
                          : 0
                      }`;
                    })
                    .join(" ")}
                />
                <polyline
                  fill="none"
                  stroke="pink"
                  stroke-width="2"
                  points={`0,${
                    graphHeight -
                    Math.floor(
                      (graphHeight / 100) *
                        ((secondaryValue[selectedField].avg /
                          secondaryValue[selectedField].max) *
                          100)
                    )
                  } ${graphWidth},${
                    graphHeight -
                    Math.floor(
                      (graphHeight / 100) *
                        ((secondaryValue[selectedField].avg /
                          secondaryValue[selectedField].max) *
                          100)
                    )
                  }`}
                />
              </>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

export default App;
