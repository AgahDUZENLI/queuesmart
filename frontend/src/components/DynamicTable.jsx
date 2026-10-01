/*
    Use this component to render tables with an unknown number of rows and columns. 
    It will automatically adjust the table layout.
*/

/*
    NOTE:
    tableData is an array of JSON objects. Each JSON object has the following structure:

    const n = {
        tableHeader1: "data row n",
        tableHeader2: "data row n",
        tableHeader3: "...",
        ...
    }

    The table would look like this:
    | tableHeader1 | tableHeader2 | tableHeader3 | ...
    | data row 1   | data row 1   | data row 1   | ...
    | data row 2   | data row 2   | data row 2   | ...
    |  ...         | ...          | ...          | ...

    
*/

/*
    tableCaption: A string that will be displayed as the caption/title of the table.
    tableData: An array of JSON objects that will be used to populate the table rows and columns.
*/
function DynamicTable({ tableCaption, tableData }) {
    if (!tableData || tableData.length === 0) {
        return (
            <div>
                <p>No table data available.</p>
            </div>
        );
    }

    const colNames = Object.keys(tableData[0]);

    return (
        <div>
            <table id="data" className="table-data">
                <caption>{tableCaption}</caption>

                <thead>
                    <tr>
                        {colNames.map((colName) => (
                            <th key={colName}>{colName}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {tableData.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {colNames.map((colName) => (
                                <td key={colName}>
                                    {row[colName]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DynamicTable;