/*
    0. Add a place by its code (or by scanning its QR code)
    1. Select a place, then a service
    2. View estimated wait time
    3. Join or leave a queue
*/

import { useState } from "react";
import UserLayout from "../../components/UserLayout";
import Button from "../../components/Button";
import TextInput from "../../components/TextInput";
import QrScanner from "../../components/QrScanner";
import { checkCanJoin, ordinal } from "../../utils/queueRules";


function JoinQueue({ goTo, queue }) {
    const { places, services, ticket, service, place, join } = queue;
    const placeId = queue.pickedPlaceId || places[0]?.id;
    const [selectedId, setSelectedId] = useState("");
    const [error, setError] = useState("");
    const [code, setCode] = useState("");
    const [scanning, setScanning] = useState(false);
    const placeServices = services.filter((s) => s.placeId === placeId);
    const selected = placeServices.find((s) => String(s.id) === String(selectedId));

    function changePlace(newPlaceId) {
        queue.setPickedPlaceId(newPlaceId);
        setSelectedId("");
        setError("");
    }

    async function addPlace(placeCode) {
        if (await queue.addPlace(placeCode)) {
            setCode("");
            setSelectedId("");
        }
    }

    function handleAddPlace(event) {
        event.preventDefault();
        addPlace(code);
    }

    function handleScan(scannedCode) {
        setScanning(false);
        setCode(scannedCode);
        addPlace(scannedCode);
    }

    async function handleJoinQueue() {
        const problem = checkCanJoin(selected, ticket);
        if (problem) {
            setError(problem);
            return;
        }
        try {
            await join(selected);
            goTo("queue-status");
        } catch (joinError) {
            setError(joinError.message);
        }
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

            <form className="add-place" onSubmit={handleAddPlace} noValidate>
                <TextInput
                    id="place-code"
                    label="Add a place"
                    value={code}
                    onChange={setCode}
                    placeholder="e.g. 123456"
                    hint="Enter the 6-digit code from the front desk, or scan the place’s QR code."
                    maxLength={6}
                    error={queue.placeError}
                />
                <Button type="submit" variant="secondary">Add place</Button>
                <Button variant="secondary" onClick={() => setScanning(true)}>Scan QR code</Button>
            </form>

            {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}

            {places.length === 0 ? (
                <p className="hint">Add a place to see its services.</p>
            ) : (
                <div className="field place-field">
                    <label htmlFor="place">1. Place</label>
                    <select id="place" value={placeId} onChange={(event) => changePlace(Number(event.target.value))}>
                        {places.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {!ticket && (
                        <button type="button" className="link-button" onClick={() => queue.removePlace(placeId)}>
                            Remove this place
                        </button>
                    )}
                </div>
            )}

            <fieldset className="service-picker">
                <legend>2. Service</legend>
                {places.length > 0 && placeServices.length === 0 && (
                    <p className="hint">This place hasn’t added any services yet.</p>
                )}
                {placeServices.map((s) => (
                    <label key={s.id} className={s.status === "Open" ? "" : "disabled"}>
                        <input
                            type="radio"
                            name="service"
                            value={s.id}
                            checked={String(selectedId) === String(s.id)}
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
                    <strong>about {selected.wait} minutes</strong>.
                </p>
            )}

            {queue.queueError && <p className="error" role="alert">{queue.queueError}</p>}
            {error && <p className="error" role="alert">{error}</p>}

            <div className="button-row">
                <Button onClick={handleJoinQueue}>Join queue</Button>
            </div>
        </UserLayout>
    );
}

export default JoinQueue;
