/* 
    1. Overview of current queue status.
    2. Active services available
    3. Notifications summary
*/

import DynamicTable from "../../components/DynamicTable.jsx";

function UserDashboard() { 
    return (
        <div>
            <DynamicTable tableCaption="Queue Status Overview" tableData={[
                { "Service Name": "Service 1", "Current Queue Length": 5, "Average Wait Time": "10 mins" },
                { "Service Name": "Service 2", "Current Queue Length": 3, "Average Wait Time": "5 mins" },
                { "Service Name": "Service 3", "Current Queue Length": 8, "Average Wait Time": "15 mins" }
            ]} />
        </div>
          
    );
}

export default UserDashboard;