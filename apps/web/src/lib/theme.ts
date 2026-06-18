// Блокуючий скрипт у <body> до першого паінту: ставить .dark на <html> з
// localStorage('theme') або системної переваги — без «мигання» теми.
export const THEME_INIT = `(function(){try{var e=localStorage.getItem('theme');var d=e?e==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(_){}})();`
