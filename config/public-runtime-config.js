/* INBESTIGA Marketing Cloud · configuración pública administrada · v17.15.0 */
(function(){
  "use strict";
  const config=Object.freeze({
    managed:true,
    version:"v17.15.0",
    supabaseUrl:"https://vbdtdihxmapezhkfmugi.supabase.co",
    sakura:Object.freeze({enabled:true,chat:true,actions:true,learning:true,voice:true,reports:true,visualDirector:true,web:false,webProvider:"tavily",webEndpoint:"/api/sakura-web",workspaceLayout:true,academy:true,bridgeUrl:"http://127.0.0.1:8765"}),
    supabaseAnonKey:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZHRkaWh4bWFwZXpoa2ZtdWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDc4MjYsImV4cCI6MjA5MDQ4MzgyNn0.OpDYy6e0KajbIruyHZsZPLeh72665EZbRLxFLWRo0o8"
  });
  window.INBESTIGA_PUBLIC_RUNTIME_CONFIG=config;
})();
