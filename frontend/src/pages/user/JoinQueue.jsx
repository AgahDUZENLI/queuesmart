/*
    1. Select a place, then a service
    2. View estimated wait time
    3. Join or leave a queue
*/

import { useState } from "react";
import UserLayout from "../../components/UserLayout";
import Button from "../../components/Button";
import { checkCanJoin, estimateWait, ordinal } from "../../utils/queueRules";


function JoinQueue({ goTo, queue }) {
    const { places, services, ticket, service, place, join } = queue;
    const [placeId, setPlaceId] = useState(queue.pickedPlaceId || places[0].id);
    const [selectedId, setSelectedId] = useState("");
    const [error, setError] = useState("");
    const placeServices = services.filter((s) => s.placeId === placeId);
    const selected = placeServices.find((s) => s.id === selectedId);

    function changePlace(newPlaceId) {
        setPlaceId(newPlaceId);
        setSelectedId("");
        setError("");
    }

    function handleJoinQueue() {
        const problem = checkCanJoin(selected, ticket);
        if (problem) {
            setError(problem);
            return;
        }
        join(selected);
        goTo("queue-status");
    }

    return (
        <UserLayout title="Join a queue" subtitle="Choose a place, then a service. You’ll see the wait before you join." active="join-queue" goTo={goTo} queue={queue}>
            {ticket && (
                <p className="notice">
                    You are already in line for {service.name} at {place.name}. You can only be in one queue at a time.{" "}
                    <button type="button" className="link-button" onClick={() => goTo("queue-status")}>
                        View or leave your queue
                    </button>
                </p>
            )}

            <div className="field place-field">
                <label htmlFor="place">1. Place</label>
                <select id="place" value={placeId} onChange={(event) => changePlace(event.target.value)}>
                    {places.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>
                    ))}
                </select>
            </div>

            <fieldset className="service-picker">
                <legend>2. Service</legend>
                {placeServices.length === 0 && (
                    <p className="hint">This place hasn’t added any services yet.</p>
                )}
                {placeServices.map((s) => (
                    <label key={s.id} className={s.status === "Open" ? "" : "disabled"}>
                        <input
                            type="radio"
                            name="service"
                            value={s.id}
                            checked={selectedId === s.id}
                            disabled={s.status !== "Open"}
                            onChange={() => { setSelectedId(s.id); setError(""); }}
                        />
                        <span className="service-name">{s.name}</span>
                        <span className="hint">{s.waiting} waiting</span>
                        <span>{s.status === "Open" ? `about ${s.wait} min` : s.status}</span>
                    </label>
                ))}
            </fieldset>

            {selected && (
                <p>
                    You’d be <strong>{ordinal(selected.waiting + 1)} in line</strong>, with an estimated wait of{" "}
                    <strong>about {estimateWait(selected, selected.waiting)} minutes</strong>.
                </p>
            )}

            {error && <p className="error" role="alert">{error}</p>}

            <div className="button-row">
                <Button onClick={handleJoinQueue}>Join queue</Button>
            </div>
        </UserLayout>
    );
}

export default JoinQueue;
