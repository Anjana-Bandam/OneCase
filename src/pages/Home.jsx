import { useNavigate } from 'react-router-dom'
import { DEPARTMENTS } from '../data/departments'
import { useStore } from '../state/CaseStore'

const CONNECTED = ['counseling', 'academic']

function Collage() {
  const pos = DEPARTMENTS.map((d, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180
    return { d, x: 50 + 43 * Math.cos(a), y: 50 + 42 * Math.sin(a), r: ((i * 37) % 13) - 6 }
  })
  return (
    <div className="collage" aria-label="12 support departments connected around one student case">
      <svg className="collage-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pos.map(({ d, x, y }) => (
          <line key={d.id} x1="50" y1="50" x2={x} y2={y} className={CONNECTED.includes(d.id) ? 'on' : ''} />
        ))}
      </svg>
      {pos.map(({ d, x, y, r }) => (
        <div
          key={d.id}
          className={`sticker${CONNECTED.includes(d.id) ? ' on' : ''}`}
          style={{ left: `${x}%`, top: `${y}%`, '--r': `${r}deg` }}
        >
          <span className="sticker-icon" aria-hidden="true">{d.icon}</span>
          <span>{d.short}</span>
        </div>
      ))}
      <div className="case-pack">
        <div className="pack-tags">
          <span>ONE STORY</span>
          <span>ONE CASE</span>
        </div>
        <div className="pack-id">Case #1024</div>
        <div className="pack-name">Ananya Rao</div>
        <div className="pack-issue">Academic stress + emotional wellbeing</div>
        <div className="pack-rows">
          <div><span>💬 Counseling</span><b className="t-blue">In Progress</b></div>
          <div><span>📚 Academic</span><b className="t-blue">In Progress</b></div>
        </div>
        <div className="pack-foot">2 of 12 teams involved · 10 don’t see it</div>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user, loginAs } = useStore()
  // Demo shortcuts: log in with a pre-made account, then open the page.
  const demo = async (email, to) => {
    const res = await loginAs(email)
    navigate(res.error ? '/login' : to)
  }
  const needSupport = () => navigate(user?.role === 'student' ? '/support' : '/login?next=%2Fsupport')

  return (
    <div className="home">
      <section className="hero">
        <h1 className="display">
          one student.
          <br />
          one case.
        </h1>
        <p className="hero-sub">
          Tell the university your problem <b>once</b>. OneCase connects only the support teams you need, out of 12 departments, around a single shared case.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-primary btn-lg" onClick={needSupport}>
            I need support →
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate(user && user.role !== 'student' ? '/staff' : '/login?tab=staff')}>
            Staff log in
          </button>
        </div>
        <Collage />
      </section>

      <section className="stats-strip">
        <div><b>+40%</b><span>mental health referrals</span></div>
        <div><b>12</b><span>disconnected departments</span></div>
        <div><b>3 weeks</b><span>wait for a first appointment</span></div>
      </section>

      <section className="section">
        <h2 className="display-sm">what changes</h2>
        <div className="before-after">
          <div className="ba-card before">
            <h3>Before</h3>
            <ol>
              <li>Student contacts one department</li>
              <li>Gets redirected to another</li>
              <li>Explains the problem <b>again</b></li>
              <li>Departments work separately</li>
              <li>No one sees the whole picture</li>
            </ol>
          </div>
          <div className="ba-arrow" aria-hidden="true">→</div>
          <div className="ba-card after">
            <h3>With OneCase</h3>
            <ol>
              <li>Student submits <b>once</b></li>
              <li>✨ AI and simple rules suggest the relevant teams</li>
              <li><b>One</b> central case is created</li>
              <li>Teams work in parallel and update their own tasks</li>
              <li>Everyone sees the same progress until it’s resolved</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="display-sm">how it works</h2>
        <div className="flow">
          {[
            ['1', 'Tell us once', '7 quick questions plus your own words'],
            ['2', 'Right teams', '✨ AI suggests departments, and you confirm'],
            ['3', 'One case', 'A single case with one task per team'],
            ['4', 'Shared progress', 'Teams update their tasks, and everyone sees it'],
            ['5', 'Resolved', 'Closed when every team is done'],
          ].map(([n, t, s]) => (
            <div className="flow-step" key={n}>
              <b>{n}</b>
              <h4>{t}</h4>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="display-sm">try the demo</h2>
        <div className="demo-grid">
          <button className="demo-card" onClick={() => navigate('/login?mode=signup')}>
            <span>✍️</span>
            <b>New student: sign up</b>
            <small>Create an account, then submit a request</small>
          </button>
          <button className="demo-card" onClick={() => demo('ananya@vasavi.edu', '/my-case/1024')}>
            <span>🎓</span>
            <b>Ananya (student)</b>
            <small>Track Case #1024</small>
          </button>
          <button className="demo-card" onClick={() => demo('counseling@vasavi.edu', '/staff')}>
            <span>💬</span>
            <b>Counseling staff</b>
            <small>Update #1024 and unlock #1026</small>
          </button>
          <button className="demo-card" onClick={() => demo('academic@vasavi.edu', '/staff')}>
            <span>📚</span>
            <b>Academic Support staff</b>
            <small>Work on the same shared cases</small>
          </button>
          <button className="demo-card" onClick={() => demo('coordinator@vasavi.edu', '/coordinator')}>
            <span>🧭</span>
            <b>Coordinator</b>
            <small>All cases and 12-department workload</small>
          </button>
        </div>
      </section>
    </div>
  )
}
