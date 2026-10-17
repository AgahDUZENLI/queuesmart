/*
    1. Overview of current queue status.
    2. Places and their active services
    3. Notifications summary
*/

import UserLayout from '../../components/UserLayout'
import Button from '../../components/Button'
import Notifications from '../../components/Notifications'
import WaitWheel from '../../components/WaitWheel'
import { ordinal, waitProgress } from '../../utils/queueRules'

function UserDashboard({ goTo, queue }) {
    const { places, services, ticket, service, place, minutesLeft } = queue
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    return (
        <UserLayout title="Hi, Maya" subtitle={today} active="user-dashboard" goTo={goTo} queue={queue}>
            <div className="two-panels">
                <section className="section">
                    <h2>Your place in line</h2>
                    {ticket ? (
                        <>
                            <WaitWheel
                                minutesLeft={minutesLeft}
                                progress={waitProgress(ticket, minutesLeft)}
                                label={`${ticket.number} · ${ordinal(ticket.peopleAhead + 1)} in line`}
                            />
                            <p>{service.name} at {place.name}, {service.room} · joined {ticket.joinedAt}</p>
                            <Button variant="secondary" onClick={() => goTo('queue-status')}>
                                View ticket
                            </Button>
                        </>
                    ) : (
                        <>
                            <p>You are not in a queue right now.</p>
                            <Button onClick={() => goTo('join-queue')}>Join a queue</Button>
                        </>
                    )}
                </section>

                <section className="section">
                    <h2>Places</h2>
                    <ul className="service-list">
                        {places.map((p) => {
                            const openCount = services.filter((s) => s.placeId === p.id && s.status === 'Open').length
                            return (
                                <li key={p.id}>
                                    <div>
                                        <strong>{p.name}</strong>
                                        <span className="hint">
                                            {p.kind} · {openCount > 0 ? `${openCount} services open` : 'No services yet'}
                                        </span>
                                    </div>
                                    {/* One queue at a time: no buttons while you are in line */}
                                    {place?.id === p.id && <span className="in-line">You’re in line</span>}
                                    {!ticket && openCount > 0 && (
                                        <Button variant="secondary" onClick={() => { queue.setPickedPlaceId(p.id); goTo('join-queue') }}>
                                            See services
                                        </Button>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </section>
            </div>

            <Notifications notifications={queue.notifications} onMarkAsRead={queue.markAsRead} />
        </UserLayout>
    );
}

export default UserDashboard;
