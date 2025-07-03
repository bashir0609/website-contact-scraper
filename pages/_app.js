import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        body {
          background: linear-gradient(135deg, #3b82f6, #4f46e5);
          font-family: system-ui, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 0;
        }
      `}</style>
      <Component {...pageProps} />
    </>
  )
}
