/*
    1. List of past queues joined
    2. Date, service name, and outcome
*/

import { useState } from "react";
import DynamicTable from "../../components/DynamicTable.jsx";


function UserHistory({goTo}) { 
    const [selectedRow, setSelectedRow] = useState(null);

    function handleRowClick(rowData) {
      setSelectedRow(rowData);
    }

    return (
        <div>
            <header className="header">
              <h1>User History</h1>

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
                    To join a service {' '}
                    <button type="button" className="link-button" onClick={() => goTo('join-queue')}>
                        click me
                    </button>!
                </p>
                
                <br/>

                <p>
                    <DynamicTable 
                    tableCaption="Past Services" 
                    tableData={[
                        { "Date": "2023-06-15", "Service Name": "Service 1", "Outcome": "Completed" },
                        { "Date": "2024-05-02", "Service Name": "Service 2", "Outcome": "Completed" },
                        { "Date": "2026-11-29", "Service Name": "Service 3", "Outcome": "Completed" }
                        ]}
                    onRowClick={handleRowClick}
                    />
                </p>
            </main>
            
        </div>
          
    );
}

export default UserHistory;