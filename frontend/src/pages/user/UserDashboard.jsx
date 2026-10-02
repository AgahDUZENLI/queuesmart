/* 
    1. Overview of current queue status.
    2. Active services available
    3. Notifications summary
*/

function UserDashboard({goTo}) { 


    return (
        <div>
            <header className="header">
              <h1>Dashboard</h1>

              <p>
                <button type="button" className="sign-out" onClick={() => goTo('sign-in')}>
                  Sign out
                </button>
              </p>
            </header>
            <main className="container">
              <h3>Current Status Overview</h3>
              <p>
                To view your queue status {' '}
                  <button type="button" className="link-button" onClick={() => goTo('queue-status')}>
                      click me
                  </button>!
              </p>

              <h3>Active Services Available</h3>
              <p>
                To view active services or join one {' '}
                  <button type="button" className="link-button" onClick={() => goTo('join-queue')}>
                      click me
                  </button>!
              </p>

              <h3>Service History</h3>
              <p>
                  To view your past services {' '}
                  <button type="button" className="link-button" onClick={() => goTo('user-history')}>
                      click me
                  </button>!
              </p>

              <h3>Notifications Summary</h3>
              <p>
                no new notifications...(placeholder for notifications)
              </p>
            </main>
            
        </div>
          
    );
}

export default UserDashboard;