function ResourceItem({ name, length }) {
  return `
    <li>
      <a href="${name}">/${name}</a>
      <sup>${length ? `${length}x` : 'object'}</sup>
    </li>
  `
}

function ResourceList({ db }) {
  return `
    <ul>
      ${Object.keys(db)
        .map((name) =>
          ResourceItem({
            name,
            length: Array.isArray(db[name]) && db[name].length,
          })
        )
        .join('')}
    </ul>
  `
}

function NoResources() {
  return `<p>No resources found</p>`
}

function ResourcesBlock({ db }) {
  return `
    <div>
      <h1>Resources</h1>
      ${Object.keys(db).length ? ResourceList({ db }) : NoResources()}
    </div>
  `
}

window
  .fetch('db')
  .then((response) => response.json())
  .then(
    (db) =>
      (document.getElementById('resources').innerHTML = ResourcesBlock({ db }))
  )

function CustomRoutesBlock({ customRoutes }) {
  const rules = Object.keys(customRoutes)
  if (rules.length) {
    return `
      <div>
        <h1>Custom Routes</h1>
        <table>
          ${rules
            .map(
              (rule) =>
                `<tr>
              <td>${rule}</td>
              <td><code>⇢</code> ${customRoutes[rule]}</td>
            </tr>`
            )
            .join('')}
        </table>
      </div>
    `
  } else {
    return ''
  }
}


function CustomRoutersBlock({ customRouters }) {
  const rules = Array.isArray(customRouters) ? customRouters : []
  if (rules.length) {
    return `
      <div>
        <h1>Custom Route Handlers</h1>
        <table>
          ${rules
            .map(
              (rule) => {
                if (!/:/.test(rule.route)) {
                return `<tr>
              <td><a href="${rule.route}">${rule.route}</a></td>
              <td><code>⇢</code> ${rule.path}</td>
            </tr>`
                } else {
                  return `<tr>
              <td>${rule.route}</td>
              <td><code>⇢</code> ${rule.path}</td>
            </tr>`
                }
              })
            .join('')}
        </table>
      </div>
    `
  } else {
    return ''
  }
}


function AssetsFixerBlock({ assetsFixer }) {
  const rules = Object.keys(assetsFixer)
  if (rules.length) {
    return `
      <div>
        <h1>Assets Path Fixup</h1>
        <table>
          ${rules
            .map(
              (rule) =>
                `<tr>
              <td>${rule}</td>
              <td><code>⇢</code> ${
                assetsFixer[rule].map(s => 
                  `<code>${s}</code>`
                ).join('')}</td>
            </tr>`
            )
            .join('')}
        </table>
      </div>
    `
  } else {
    return ''
  }
}

window
  .fetch('__rules')
  .then((response) => response.json())
  .then(
    (customRoutes) =>
      (document.getElementById('custom-routes').innerHTML = CustomRoutesBlock({
        customRoutes,
      }))
  )

window
  .fetch('__routers')
  .then((response) => response.json())
  .then(
    (customRouters) =>
      (document.getElementById('custom-routers').innerHTML = CustomRoutersBlock({
        customRouters,
      }))
  )


window
  .fetch('__assets-fixer')
  .then((response) => response.json())
  .then(
    (assetsFixer) =>
      (document.getElementById('assets-fixer').innerHTML = AssetsFixerBlock({
        assetsFixer,
      }))
  )
