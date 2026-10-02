/*
    1. Current position in queue
    2. Estimated wait time
    3. Status updates (waiting, almost ready, served)
*/

import { useState } from "react";
import DynamicTable from "../../components/DynamicTable.jsx";


function QueueStatus({goTo}) { 
    //temporary data below...
    const [tableData, setTableData] = useState([
        { 
            "Service Name": "Service 1", 
            "Current Queue Position": 3, 
            "Average Wait Time": "10 mins", 
            "Status Updates": "waiting"
        },
        { 
            "Service Name": "Service 2", 
            "Current Queue Position": 2, 
            "Average Wait Time": "5 mins", 
            "Status Updates": "almost ready"
        },
        { 
            "Service Name": "Service 3", 
            "Current Queue Position": 4, 
            "Average Wait Time": "15 mins", 
            "Status Updates": "served"
        }
    ]);

    function handleRowClick(rowData) {
        const confirmed = window.confirm(
            "Are you sure you want to leave the queue for: " +
            rowData["Service Name"] +
            "\nYour current position in the queue is: " +
            rowData["Current Queue Position"]
        );

        if (confirmed) {
            setTableData(currentData =>
                currentData.filter(row =>
                    row["Service Name"] !== rowData["Service Name"]
                )
            );

            console.log("Leaving queue:", rowData["Service Name"]);
        }
    }

    return (
        <div>
            <header className="header">
              <h1>Queue Status</h1>

              <p>
                <button type="button" className="sign-out" onClick={() => goTo('sign-in')}>
                  Sign out
                </button>
              </p>
            </header>
            <main className="container">
                <h3>Links to Other Pages</h3>
                <p>
                    To view your dashboard {' '}
                    <button type="button" className="link-button" onClick={() => goTo('user-dashboard')}>
                        click me
                    </button>!
                </p>

                <p>
                    To view your past services {' '}
                    <button type="button" className="link-button" onClick={() => goTo('user-history')}>
                        click me
                    </button>!
                </p>

                <p>
                    To join a service {' '}
                    <button type="button" className="link-button" onClick={() => goTo('join-queue')}>
                        click me
                    </button>!
                </p>

                <br/>
              
                <p>
                    To leave a queue, select the service you want to leave from the table below...
                </p>

                <br/>

              <p>
                <DynamicTable 
                  tableCaption="Queue Status Overview" 
                  tableData={tableData}
                  onRowClick={handleRowClick}
                   />
              </p>
            </main>
            
        </div>
          
    );
}

export default QueueStatus;