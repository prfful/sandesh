import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  componentDidCatch(error, info) {
    // Save to state so we can render a helpful message
    this.setState({ error, info })
    // Also log to console
    // eslint-disable-next-line no-console
    console.error('Unhandled error caught by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ color: '#c53030' }}>अनपेक्षित त्रुटि</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff5f5', padding: 12, borderRadius: 6 }}>
            {String(this.state.error)}
          </pre>
          <details style={{ marginTop: 12 }}>
            <summary>स्टैक और जानकारी</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}
