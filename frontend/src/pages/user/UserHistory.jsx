/*
    1. List of past queues joined
    2. Date, service name, and outcome
*/

import DynamicTable from "../../components/DynamicTable.jsx";
import UserLayout from "../../components/UserLayout";


function UserHistory({ goTo, queue }) {
    return (
        <UserLayout title="History" subtitle="Queues you joined before." active="user-history" goTo={goTo} queue={queue}>
            <DynamicTable
                tableCaption="Past visits"
                tableData={queue.history}
            />
        </UserLayout>
    );
}

export default UserHistory;
