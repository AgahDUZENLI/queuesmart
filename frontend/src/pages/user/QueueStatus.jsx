/*
    1. Current position in queue
    2. Estimated wait time
    3. Status updates (waiting, almost ready, served)
*/

import { useState } from "react";
import UserLayout from "../../components/UserLayout";
import Button from "../../components/Button";
import WaitWheel from "../../components/WaitWheel";
import { ordinal, queueStatus, waitProgress } from "../../utils/queueRules";

const steps = ["Waiting", "Almost ready", "Served"];

function QueueStatus({ goTo, queue }) {
    const { ticket, service, place, minutesLeft, leave, nextPersonServed } = queue;
    const [servedAt, setServedAt] = useState("");

    // Not in a queue (never joined, left, or already served)
    if (!ticket) {
        return (
            <UserLayout title="Queue status" subtitle={servedAt ? "Status: Served" : "You are not in a queue right now."} active="queue-status" goTo={goTo} queue={queue}>
                <section className="section">
                    {servedAt && <p>You were served at {servedAt}. Thanks for visiting!</p>}
                    <Button onClick={() => goTo("join-queue")}>Join a queue</Button>
                </section>
            </UserLayout>
        );
    }

    const status = queueStatus(ticket.peopleAhead);

    function handleNext() {
        if (ticket.peopleAhead === 0) {
            setServedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        }
        nextPersonServed();
    }

    function handleLeave() {
        const confirmed = window.confirm(
            "Are you sure you want to leave the queue for " + service.name + " at " + place.name + "?\nYou will lose your place in line."
        );
        if (confirmed) leave();
    }

    return (
        <UserLayout title={service.name} subtitle={`${place.name} · Status: ${status}`} active="queue-status" goTo={goTo} queue={queue}>
            <div className="two-panels">
                <WaitWheel
                    minutesLeft={minutesLeft}
                    progress={waitProgress(ticket, minutesLeft)}
                    label={ticket.peopleAhead === 0 ? "You're next" : `${ticket.peopleAhead} ahead of you`}
                />

                <div>
                    <dl className="facts">
                        <div><dt>Ticket</dt><dd>{ticket.number}</dd></div>
                        <div><dt>Position</dt><dd>{ordinal(ticket.peopleAhead + 1)} in line</dd></div>
                        <div><dt>Estimated wait</dt><dd>{ticket.peopleAhead === 0 ? "You're next" : `about ${minutesLeft} min`}</dd></div>
                        <div><dt>Joined</dt><dd>{ticket.joinedAt}</dd></div>
                        <div><dt>Where</dt><dd>{place.name}, {service.room}</dd></div>
                    </dl>

                    <ol className="status-steps" aria-label="Status">
                        {steps.map((step) => (
                            <li key={step} className={step === status ? "current" : ""}>{step}</li>
                        ))}
                    </ol>

                    <div className="button-row">
                        <Button variant="secondary" onClick={handleNext}>
                            {ticket.peopleAhead === 0 ? "Simulate: my turn" : "Simulate: next person served"}
                        </Button>
                        <Button variant="danger" onClick={handleLeave}>Leave queue</Button>
                    </div>
                    <p className="hint">The simulate button stands in for live updates until the backend exists.</p>
                </div>
            </div>
        </UserLayout>
    );
}

export default QueueStatus;
