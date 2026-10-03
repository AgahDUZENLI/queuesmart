/* 
    1. Select a service
    2. View estimated wait time
    3. Join or leave a queue
*/

import { useState } from "react";
import DynamicTable from "../../components/DynamicTable.jsx";


function JoinQueue({goTo}) { 
    const [selectedRow, setSelectedRow] = useState(null);

    function handleRowClick(rowData) {
      setSelectedRow(rowData);
  }

    function handleJoinQueue() {
        if (!selectedRow) {
            alert("Please select a service to join the queue.");
        }
        else  {
            alert(`You have joined the queue for ${selectedRow["Service Name"]}!`); 
        }
    }

    return (
        <div>
            <header className="header">
              <h1>Join Queue</h1>

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
                    To view your queue status {' '}
                    <button type="button" className="link-button" onClick={() => goTo('queue-status')}>
                        click me
                    </button>!
                </p>

                <p>
                    To view your past services {' '}
                    <button type="button" className="link-button" onClick={() => goTo('user-history')}>
                        click me
                    </button>!
                </p>
                
                <br/>

                <p>
                    To join a queue, click on a service from the table below...
                </p>

                <br/>

                <p>
                    {selectedRow && (
                        <p>
                            Are you sure you want to join the queue for: {selectedRow ? selectedRow["Service Name"] : "None"}?<br/>
                            Your position in the queue will be: {selectedRow ? selectedRow["Current Queue Length"] + 1 : "N/A"}<br/>
                            The estimated wait time is: {selectedRow ? selectedRow["Average Wait Time"] : "N/A"}<br/>
                        </p>
                    )}
                </p>

                <br/>

                <p>
                    <button type="button" className="join-queue" onClick={handleJoinQueue}>
                        Confirm Join Queue
                    </button>
                </p>

                <br/>

                <p>
                    To leave a queue, follow the link to the queue status page and leave the queue there.
                </p>

                <p>
                    <DynamicTable 
                    tableCaption="Available Services" 
                    tableData={[
                        { "Service Name": "Service 1", "Current Queue Length": 5, "Average Wait Time": "10 mins" },
                        { "Service Name": "Service 2", "Current Queue Length": 3, "Average Wait Time": "5 mins" },
                        { "Service Name": "Service 3", "Current Queue Length": 8, "Average Wait Time": "15 mins" },
                        { "Service Name": "Service 4", "Current Queue Length": 25, "Average Wait Time": "8 mins" },
                        { "Service Name": "Service 5", "Current Queue Length": 2, "Average Wait Time": "9 mins" },
                        { "Service Name": "Service 6", "Current Queue Length": 6, "Average Wait Time": "23 mins" }
                        ]}
                    onRowClick={handleRowClick}
                    />
                </p>
            </main>
            
        </div>
          
    );
}

export default JoinQueue;