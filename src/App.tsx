import { CARTRIDGES } from './content/cartridges'
import { MachineBoundary } from './machine/MachineBoundary'

export default function App() {
  return (
    <>
      <header className="site-header">
        <div>
          <p className="eyebrow">Interactive portfolio</p>
          <h1>The Vitek Machine</h1>
          <p className="lede">Four projects, operated as physical cartridges inside one mechanical world.</p>
        </div>
        <a className="skip-link" href="#cartridge-list">Skip machine; browse projects</a>
      </header>

      <main>
        <MachineBoundary />

        <section
          id="cartridge-list"
          className="cartridge-register"
          aria-labelledby="cartridge-title"
          tabIndex={-1}
        >
          <div>
            <p className="eyebrow">Cartridge register</p>
            <h2 id="cartridge-title">Four cartridges</h2>
          </div>
          <ul>
            {CARTRIDGES.map((name) => (
              <li key={name}>
                <span className="register-shape" aria-hidden="true" />
                <h3>{name}</h3>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer>
        <p>Production foundation. Verified project details and final machine geometry follow in later stages.</p>
      </footer>
    </>
  )
}
