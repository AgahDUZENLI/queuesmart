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
    const { ticket, service, place, minutesLeft, leave, lastOutcome } = queue;
    const [error, setError] = useState("");

    // Not in a queue (never joined, left, or already served)
    if (!ticket) {
        const served = lastOutcome === "served";
        return (
            <UserLayout title="Queue status" subtitle={served ? "Status: Served" : "You are not in a queue right now."} active="queue-status" goTo={goTo} queue={queue}>
                <section className="section">
                    {served && <p>Your ticket has been served. Thanks for visiting!</p>}
                    {lastOutcome === "no-show" && <p>Your ticket was marked as a no-show.</p>}
                    {lastOutcome === "removed" && <p>Your ticket was removed from the queue.</p>}
                    {queue.queueError && <p className="error" role="alert">{queue.queueError}</p>}
                    <Button onClick={() => goTo("join-queue")}>Join a queue</Button>
                </section>
            </UserLayout>
        );
    }

    const status = ticket.status === "serving" ? "Being served" : queueStatus(ticket.peopleAhead);
    const currentStep = status === "Being served" ? "Almost ready" : status;

    async function handleLeave() {
        const confirmed = window.confirm(
            "Are you sure you want to leave the queue for " + service.name + " at " + place.name + "?\nYou will lose your place in line."
        );
        if (confirmed) {
            try {
                await leave();
            } catch (leaveError) {
                setError(leaveError.message);
            }
        }
    }

    return (
        <UserLayout title={service.name} subtitle={`${place.name} · Status: ${status}`} active="queue-status" goTo={goTo} queue={queue}>
            <div className="two-panels">
                <WaitWheel
                    minutesLeft={minutesLeft}
                    progress={waitProgress(ticket, minutesLeft)}
                    label={ticket.status === "serving" ? "Being served" : ticket.peopleAhead === 0 ? "You're next" : `${ticket.peopleAhead} ahead of you`}
                />

                <div>
                    <dl className="facts">
                        <div><dt>Ticket</dt><dd>{ticket.number}</dd></div>
                        <div><dt>Position</dt><dd>{ordinal(ticket.peopleAhead + 1)} in line</dd></div>
                        <div><dt>Estimated wait</dt><dd>{ticket.status === "serving" ? "Being served" : ticket.peopleAhead === 0 ? "You're next" : `about ${minutesLeft} min`}</dd></div>
                        <div><dt>Joined</dt><dd>{ticket.joinedAt}</dd></div>
                        <div><dt>Where</dt><dd>{place.name}</dd></div>
                    </dl>

                    <ol className="status-steps" aria-label="Status">
                        {steps.map((step) => (
                            <li key={step} className={step === currentStep ? "current" : ""}>{step}</li>
                        ))}
                    </ol>

                    <div className="button-row">
                        <Button variant="danger" onClick={handleLeave}>Leave queue</Button>
                    </div>
                    <p className="hint">Your ticket and wait estimate update automatically.</p>
                    {error && <p className="error" role="alert">{error}</p>}
                    {queue.queueError && <p className="error" role="alert">{queue.queueError}</p>}
                </div>
            </div>
        </UserLayout>
    );
}

export default QueueStatus;
