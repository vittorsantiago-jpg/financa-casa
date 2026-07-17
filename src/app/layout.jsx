export const metadata = {
  title: "Finanças da Casa",
  description: "Gestão financeira doméstica compartilhada",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Finanças" },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#312e81",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Força modo claro — impede Chrome/Android de inverter as cores */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root { color-scheme: light !important; }
          html, body { background-color: #f0f4ff !important; color: #1e1b4b !important; }
          * { -webkit-color-scheme: light !important; color-scheme: light !important; }
        `}} />
      </head>
      <body style={{
        margin: 0, padding: 0,
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#f0f4ff",
        color: "#1e1b4b",
        colorScheme: "light",
        WebkitColorScheme: "light",
      }}>
        {children}
      </body>
    </html>
  );
}
