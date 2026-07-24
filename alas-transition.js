/**
 * ALASMotionBridge — alas-transition.js  v1.4
 * Transición estándar del ecosistema ALAS.
 * Estilo "Empuje desde la derecha" — como PowerPoint / iOS navigation.
 *
 * Entrada:  contenido llega DESDE LA DERECHA → se asienta al centro
 * Salida:   contenido vuelve HACIA LA DERECHA → (regresa de donde vino)
 *
 * v1.4 · Usa GSAP cuando está disponible (curvas y encadenado más finos).
 *        Si GSAP no está cargado todavía (p. ej. corre en el <head> antes que
 *        la CDN de GSAP), cae AUTOMÁTICAMENTE a transiciones CSS — mismo look.
 *        El estado inicial (fuera de pantalla) se aplica con estilos inline,
 *        así funciona aunque GSAP aún no exista al momento de init().
 *
 * Uso:
 *   ALASTransition.init({ root: '.mi-contenedor' })
 *   ALASTransition.enterProject()
 *   ALASTransition.exitToLauncher(url)
 *
 * Compatible: HTML puro, Vanilla JS, Vite, React.
 * No toca: SSO, Supabase, sesiones, lógica de negocio.
 */
;(function (global) {
  'use strict'

  var _rootSel = null

  // ── Valores del movimiento (estándar ecosistema) ───────────────────────────
  var X_OUT  = 80        // px — distancia horizontal
  var SC_OUT = 0.96      // escala sutil
  var BL_OUT = 5         // px — blur suavizado

  // Entrada: derecha → centro (rápida al inicio, desaceleración larga)
  var DUR_IN     = 0.70                          // s (GSAP)
  var CSS_DUR_IN = 680                           // ms (fallback CSS)
  var ESE_IN     = 'expo.out'                    // GSAP ≈ --alas-ease
  var ESE_IN_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)'

  // Salida: centro → derecha (limpia y decidida)
  var DUR_OUT     = 0.42                          // s (GSAP)
  var CSS_DUR_OUT = 420                           // ms (fallback CSS)
  var ESE_OUT     = 'power3.in'                   // GSAP ≈ --alas-ease-in
  var ESE_OUT_CSS = 'cubic-bezier(0.3, 0, 0.8, 0.15)'

  // ── Helpers ────────────────────────────────────────────────────────────────
  function G () { return (global && global.gsap) || (typeof window !== 'undefined' && window.gsap) || null }
  function reduced () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
  }
  function getEl () {
    if (!_rootSel) return null
    if (typeof _rootSel === 'string') return document.querySelector(_rootSel)
    return _rootSel
  }

  // Estado inicial estático (fuera de pantalla). Se aplica en init(), ANTES de
  // que exista GSAP → siempre por estilos inline. GSAP luego los lee y anima.
  function setOffscreenRight (el) {
    el.style.opacity    = '0'
    el.style.transform  = 'translateX(' + X_OUT + 'px) scale(' + SC_OUT + ')'
    el.style.filter     = 'blur(' + BL_OUT + 'px)'
    el.style.willChange = 'opacity, transform, filter'
  }

  function clearInline (el) {
    el.style.transition = ''
    el.style.willChange = ''
    el.style.transform  = ''
    el.style.filter     = ''
    el.style.opacity    = ''
  }

  // ── API pública ────────────────────────────────────────────────────────────
  var ALASTransition = {

    init: function (opts) {
      opts     = opts || {}
      _rootSel = opts.root || null

      function setup () {
        var el = getEl()
        if (el && !reduced()) setOffscreenRight(el)
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup, { once: true })
      } else {
        setup()
      }
      return this
    },

    enterProject: function () {
      var el = getEl()
      if (!el) return this

      if (reduced()) { clearInline(el); return this }

      var g = G()
      if (g) {
        // ── GSAP: empuje lateral con blur que se despeja un poco antes ──────
        g.killTweensOf(el)
        var tl = g.timeline({
          onComplete: function () { g.set(el, { clearProps: 'transform,filter,willChange' }) }
        })
        tl.to(el, { opacity: 1, x: 0, scale: 1, duration: DUR_IN, ease: ESE_IN }, 0)
          .to(el, { filter: 'blur(0px)', duration: DUR_IN * 0.62, ease: 'power2.out' }, 0)
        return this
      }

      // ── Fallback CSS (v1.3) ─────────────────────────────────────────────
      void el.offsetHeight
      el.style.transition = [
        'opacity '   + CSS_DUR_IN + 'ms ' + ESE_IN_CSS,
        'transform ' + CSS_DUR_IN + 'ms ' + ESE_IN_CSS,
        'filter '    + Math.round(CSS_DUR_IN * 0.6) + 'ms ' + ESE_IN_CSS
      ].join(', ')
      el.style.opacity   = '1'
      el.style.transform = 'translateX(0) scale(1)'
      el.style.filter    = 'blur(0px)'
      setTimeout(function () {
        el.style.transition = ''
        el.style.willChange = ''
        el.style.transform  = ''
        el.style.filter     = ''
      }, CSS_DUR_IN + 100)
      return this
    },

    exitToLauncher: function (url) {
      if (!url) {
        if (typeof console !== 'undefined') console.warn('[ALASTransition] exitToLauncher: se requiere una URL')
        return this
      }

      var el = getEl()
      if (!el || reduced()) { window.location.href = url; return this }

      var navigated = false
      function go () { if (navigated) return; navigated = true; window.location.href = url }

      var g = G()
      if (g) {
        // ── GSAP: sale hacia la derecha, blur entra un poco antes ───────────
        g.killTweensOf(el)
        g.set(el, { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', willChange: 'opacity, transform, filter' })
        var tl = g.timeline({ onComplete: go })
        tl.to(el, { opacity: 0, x: X_OUT, scale: SC_OUT, duration: DUR_OUT, ease: ESE_OUT }, 0)
          .to(el, { filter: 'blur(' + BL_OUT + 'px)', duration: DUR_OUT * 0.6, ease: 'power2.in' }, 0)
        // Respaldo: si la pestaña está en background y onComplete no dispara.
        setTimeout(go, DUR_OUT * 1000 + 120)
        return this
      }

      // ── Fallback CSS (v1.3) ─────────────────────────────────────────────
      el.style.opacity    = '1'
      el.style.transform  = 'translateX(0) scale(1)'
      el.style.filter     = 'blur(0px)'
      el.style.willChange = 'opacity, transform, filter'
      void el.offsetHeight
      el.style.transition = [
        'opacity '   + CSS_DUR_OUT + 'ms ' + ESE_OUT_CSS,
        'transform ' + CSS_DUR_OUT + 'ms ' + ESE_OUT_CSS,
        'filter '    + Math.round(CSS_DUR_OUT * 0.55) + 'ms ' + ESE_OUT_CSS
      ].join(', ')
      el.style.opacity   = '0'
      el.style.transform = 'translateX(' + X_OUT + 'px)'
      el.style.filter    = 'blur(' + BL_OUT + 'px)'
      setTimeout(go, CSS_DUR_OUT + 40)
      return this
    }

  }

  global.ALASTransition = ALASTransition
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ALASTransition
  }

}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this))
