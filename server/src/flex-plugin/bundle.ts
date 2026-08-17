/**
 * CubeSmart — Flex plugin bundle.
 *
 * Flex loads a plugin by fetching a JavaScript bundle and calling
 * `Twilio.Flex.Plugins.init(PluginClass)`. Everything a plugin needs is already
 * on the page as a global (`window.React`, `window.Twilio.Flex`), which is why
 * the official build tooling marks them as webpack externals.
 *
 * This bundle is written directly against those globals so it needs no build
 * step and no CLI — the server serves it verbatim and the Flex Plugins API
 * points at it. The equivalent JSX/TypeScript source (for anyone who wants to
 * rebuild it the conventional way) lives in `/flex-plugin`.
 *
 * NOTE: the bundle body must not contain backticks or template placeholders,
 * because it lives inside a TypeScript template literal.
 */

export const FLEX_PLUGIN_UNIQUE_NAME = "cubesmart-tenant-context";
export const FLEX_PLUGIN_FRIENDLY_NAME = "CubeSmart — Tenant Context";
export const FLEX_PLUGIN_VERSION = "1.0.0";
export const FLEX_PLUGIN_PATH =
  "/flex-plugin/cubesmart-tenant-context-" + FLEX_PLUGIN_VERSION + ".js";

export const FLEX_PLUGIN_BUNDLE = `/* CubeSmart — Tenant Context plugin for Twilio Flex */
(function () {
  'use strict';

  var w = typeof window !== 'undefined' ? window : null;
  if (!w) return;

  var TwilioGlobal = w.Twilio;
  var React = w.React;

  if (!TwilioGlobal || !TwilioGlobal.Flex || !TwilioGlobal.Flex.Plugins || !React) {
    if (w.console) w.console.warn('[cubesmart-tenant-context] Flex or React global missing.');
    return;
  }

  var Flex = TwilioGlobal.Flex;

  function h(type, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    return React.createElement.apply(React, [type, props].concat(children));
  }

  var C = {
    orange: '#ff7a1a',
    glow: '#ffa552',
    panel: '#2b1a10',
    bg: '#150e09',
    line: 'rgba(255,255,255,0.09)',
    soft: 'rgba(255,255,255,0.035)',
    text: '#f7f5f3',
    dim: 'rgba(247,245,243,0.6)',
    faint: 'rgba(247,245,243,0.38)',
    amber: '#fbbf24',
    amberBg: 'rgba(251,191,36,0.09)',
    amberLine: 'rgba(251,191,36,0.34)',
    red: '#fb7185',
    redBg: 'rgba(251,113,133,0.09)',
    redLine: 'rgba(251,113,133,0.34)'
  };

  var FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

  /* ---------------- helpers ---------------- */

  function attrsOf(task) {
    if (!task) return {};
    var a = task.attributes;
    if (!a) return {};
    if (typeof a === 'string') {
      try { return JSON.parse(a); } catch (e) { return {}; }
    }
    return a;
  }

  function cubesmartOf(a) {
    return (a && a.cubesmart) || {};
  }

  function intelOf(a) {
    return (a && a.intelligence) || {};
  }

  function hasIntel(i) {
    if (!i) return false;
    return Boolean(i.call_reason || i.sentiment || i.retention_risk_score !== null && i.retention_risk_score !== undefined || i.next_best_action);
  }

  function text(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback || '—';
    return String(v);
  }

  function prettyPhone(raw) {
    var digits = String(raw || '').replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') {
      return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
    }
    return String(raw || '—');
  }

  function titleCase(v) {
    var s = String(v || '');
    if (!s) return '—';
    s = s.replace(/[-_]/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function asList(v) {
    if (!v) return [];
    if (Object.prototype.toString.call(v) === '[object Array]') return v;
    return [v];
  }

  /* ---------------- primitives ---------------- */

  function Mark(props) {
    var size = props && props.size ? props.size : 22;
    return h(
      'span',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 6,
          height: size + 6,
          borderRadius: 7,
          background: 'linear-gradient(140deg, #ff7a1a, #c2570a)',
          flexShrink: 0
        }
      },
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size - 4, height: size - 4, 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 12, width: 8, height: 8, rx: 1, fill: 'none', stroke: '#1c130d', strokeWidth: 1.6 }),
        h('rect', { x: 13, y: 12, width: 8, height: 8, rx: 1, fill: 'none', stroke: '#1c130d', strokeWidth: 1.6 }),
        h('rect', { x: 8, y: 3, width: 8, height: 8, rx: 1, fill: '#1c130d' })
      )
    );
  }

  function Pill(props) {
    var tone = props.tone || 'neutral';
    var map = {
      good: { fg: C.glow, bg: 'rgba(255,165,82,0.14)', bd: 'rgba(255,165,82,0.4)' },
      warn: { fg: C.amber, bg: C.amberBg, bd: C.amberLine },
      bad: { fg: C.red, bg: C.redBg, bd: C.redLine },
      neutral: { fg: C.dim, bg: C.soft, bd: C.line }
    };
    var t = map[tone] || map.neutral;
    return h(
      'span',
      {
        style: {
          display: 'inline-block',
          padding: '3px 9px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: t.fg,
          background: t.bg,
          border: '1px solid ' + t.bd,
          whiteSpace: 'nowrap'
        }
      },
      props.label
    );
  }

  function Field(props) {
    var toneColor =
      props.tone === 'bad' ? C.red : props.tone === 'warn' ? C.amber : props.tone === 'good' ? C.glow : C.text;
    return h(
      'div',
      {
        style: {
          background: C.soft,
          border: '1px solid ' + C.line,
          borderRadius: 8,
          padding: '7px 9px',
          minWidth: 0
        }
      },
      h(
        'div',
        {
          style: {
            fontSize: 9,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: C.faint,
            marginBottom: 3
          }
        },
        props.label
      ),
      h(
        'div',
        {
          style: {
            fontSize: 12,
            fontWeight: 600,
            color: toneColor,
            wordBreak: 'break-word',
            lineHeight: 1.35
          }
        },
        props.value
      )
    );
  }

  function Section(props) {
    return h(
      'div',
      { style: { marginTop: 14 } },
      h(
        'div',
        {
          style: {
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.faint,
            marginBottom: 7,
            fontWeight: 700
          }
        },
        props.title
      ),
      props.children
    );
  }

  function Grid(props) {
    return h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 7
        }
      },
      props.children
    );
  }

  function Callout(props) {
    var tone = props.tone === 'bad' ? { bg: C.redBg, bd: C.redLine, fg: C.red } : { bg: C.amberBg, bd: C.amberLine, fg: C.amber };
    return h(
      'div',
      {
        style: {
          background: tone.bg,
          border: '1px solid ' + tone.bd,
          borderRadius: 10,
          padding: '10px 12px'
        }
      },
      h(
        'div',
        {
          style: {
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: tone.fg,
            fontWeight: 700,
            marginBottom: 4
          }
        },
        props.title
      ),
      h('div', { style: { fontSize: 12.5, color: C.text, lineHeight: 1.5 } }, props.children)
    );
  }

  /* ---------------- live intelligence ---------------- */

  var BANDS = {
    low: { label: 'Low risk', fg: C.glow, bar: C.orange, tone: 'good' },
    watch: { label: 'Watch', fg: '#7dd3fc', bar: '#38bdf8', tone: 'neutral' },
    elevated: { label: 'Elevated risk', fg: C.amber, bar: C.amber, tone: 'warn' },
    high: { label: 'High risk', fg: C.red, bar: C.red, tone: 'bad' }
  };

  var SENTIMENTS = {
    positive: { label: 'Positive', tone: 'good' },
    neutral: { label: 'Neutral', tone: 'neutral' },
    mixed: { label: 'Mixed', tone: 'warn' },
    negative: { label: 'Negative', tone: 'bad' }
  };

  function bandFor(i) {
    var key = String((i && i.retention_risk_band) || '').toLowerCase();
    return BANDS[key] || null;
  }

  function Meter(props) {
    var pct = Math.max(2, Math.min(100, Number(props.value) || 0));
    return h(
      'div',
      {
        style: {
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          marginTop: 8
        }
      },
      h('div', {
        style: {
          height: '100%',
          width: pct + '%',
          borderRadius: 999,
          background: props.color,
          transition: 'width 600ms ease'
        }
      })
    );
  }

  /** The save offer. This is the whole reason the agent is looking at this panel. */
  function NextBestAction(props) {
    var nba = props.nba;
    if (!nba || !nba.offer) return null;

    return h(
      'div',
      {
        style: {
          background: 'linear-gradient(150deg, rgba(255,122,26,0.16), rgba(194,87,10,0.08))',
          border: '1px solid rgba(255,165,82,0.45)',
          borderRadius: 12,
          padding: '12px 13px'
        }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6
          }
        },
        h(
          'div',
          {
            style: {
              fontSize: 9,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: C.glow
            }
          },
          'Recommended next step'
        ),
        nba.urgency ? h(Pill, { label: String(nba.urgency), tone: 'good' }) : null
      ),
      h(
        'div',
        { style: { fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 5 } },
        text(nba.headline, 'Save offer')
      ),
      h(
        'div',
        { style: { fontSize: 12.5, lineHeight: 1.55, color: C.text } },
        String(nba.offer)
      ),
      nba.rationale
        ? h(
            'div',
            { style: { fontSize: 11.5, lineHeight: 1.5, color: C.dim, marginTop: 7 } },
            String(nba.rationale)
          )
        : null,
      nba.policy_source
        ? h(
            'div',
            {
              style: {
                fontSize: 9.5,
                color: C.faint,
                marginTop: 8,
                paddingTop: 7,
                borderTop: '1px solid rgba(255,165,82,0.2)'
              }
            },
            'From the store playbook — ' + String(nba.policy_source)
          )
        : null
    );
  }

  function IntelBlock(props) {
    var i = props.intel;
    if (!hasIntel(i)) return null;

    var band = bandFor(i);
    var score = i.retention_risk_score;
    var drivers = asList(i.retention_risk_drivers);
    var sentimentKey = String(i.sentiment || '').toLowerCase();
    var sentiment = SENTIMENTS[sentimentKey];
    var trail = asList(i.sentiment_trail);

    return h(
      Section,
      { title: 'Live call intelligence' },

      h(
        'div',
        {
          style: {
            background: C.panel,
            border: '1px solid ' + C.line,
            borderRadius: 11,
            padding: '11px 12px'
          }
        },

        /* reason + sentiment */
        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 } },
          i.call_reason
            ? h(
                'span',
                {
                  style: {
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: C.glow,
                    background: 'rgba(255,165,82,0.12)',
                    border: '1px solid rgba(255,165,82,0.3)',
                    borderRadius: 8,
                    padding: '4px 9px'
                  }
                },
                String(i.call_reason)
              )
            : null,
          sentiment ? h(Pill, { label: sentiment.label, tone: sentiment.tone }) : null,
          i.call_reason_confidence
            ? h(
                'span',
                { style: { fontSize: 9.5, color: C.faint } },
                i.call_reason_confidence + '% confident'
              )
            : null
        ),

        i.call_reason_evidence
          ? h(
              'div',
              {
                style: {
                  fontSize: 11,
                  fontStyle: 'italic',
                  color: C.dim,
                  marginTop: 7,
                  paddingLeft: 8,
                  borderLeft: '2px solid ' + C.line,
                  lineHeight: 1.5
                }
              },
              '"' + String(i.call_reason_evidence) + '"'
            )
          : null,

        trail.length > 1
          ? h(
              'div',
              { style: { fontSize: 9.5, color: C.faint, marginTop: 7 } },
              'Sentiment through the call: ' + trail.join(' → ')
            )
          : null,

        /* risk */
        band && (score || score === 0)
          ? h(
              'div',
              {
                style: {
                  marginTop: 11,
                  paddingTop: 11,
                  borderTop: '1px solid ' + C.line
                }
              },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
                h(
                  'span',
                  { style: { fontSize: 26, fontWeight: 800, lineHeight: 1, color: band.fg } },
                  String(score)
                ),
                h('span', { style: { fontSize: 10, color: C.faint } }, '/ 100'),
                h(Pill, {
                  label:
                    band.label +
                    (i.retention_risk_trend === 'rising' ? ' · rising' : ''),
                  tone: band.tone
                })
              ),
              h(Meter, { value: score, color: band.bar }),
              drivers.length
                ? h(
                    'div',
                    { style: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 } },
                    drivers.map(function (d, n) {
                      return h(
                        'span',
                        {
                          key: 'dr' + n,
                          style: {
                            fontSize: 10.5,
                            color: C.dim,
                            background: C.soft,
                            border: '1px solid ' + C.line,
                            borderRadius: 999,
                            padding: '3px 8px'
                          }
                        },
                        String(d)
                      );
                    })
                  )
                : null,
              i.retention_risk_quote
                ? h(
                    'div',
                    {
                      style: {
                        fontSize: 11,
                        fontStyle: 'italic',
                        color: C.dim,
                        marginTop: 8,
                        paddingLeft: 8,
                        borderLeft: '2px solid ' + C.line,
                        lineHeight: 1.5
                      }
                    },
                    '"' + String(i.retention_risk_quote) + '"'
                  )
                : null
            )
          : null,

        h(
          'div',
          { style: { fontSize: 9, color: C.faint, marginTop: 10 } },
          'Twilio Language Operators, scored live on this call' +
            (i.last_latency_ms ? ' · last read ' + (Number(i.last_latency_ms) / 1000).toFixed(1) + 's' : '')
        )
      )
    );
  }

  function Empty(props) {    return h(
      'div',
      {
        style: {
          fontFamily: FONT,
          background: C.bg,
          color: C.dim,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center'
        }
      },
      h(
        'div',
        null,
        h('div', { style: { marginBottom: 10 } }, h(Mark, { size: 30 })),
        h(
          'div',
          { style: { fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 } },
          'CubeSmart — Tenant Context'
        ),
        h(
          'div',
          { style: { fontSize: 12, maxWidth: 280, lineHeight: 1.5 } },
          props.message || 'Select a task to see the tenant the AI agent is handing you.'
        )
      )
    );
  }

  /* ---------------- the tenant panel ---------------- */

  function MemberPanel(props) {
    var task = props.task;
    var a = attrsOf(task);
    var e = cubesmartOf(a);

    var name = a.customerName || a.name || (a.customers && a.customers.name);
    if (!task) return h(Empty, {});
    if (!name && !e.unit_type) {
      return h(Empty, { message: 'This task did not arrive from the CubeSmart voice agent, so there is no tenant context attached.' });
    }

    var i = intelOf(a);
    var nba = i && i.next_best_action;
    var extendedAccess = String(e.account_status || '') === 'on-hold';
    var cardExpired = String(e.payment_status || '') === 'expired';
    var history = asList(e.reservation_history);
    var transcript = asList(a.recent_transcript);

    return h(
      'div',
      {
        style: {
          fontFamily: FONT,
          background: C.bg,
          color: C.text,
          height: '100%',
          overflowY: 'auto',
          padding: '14px 14px 28px'
        }
      },

      /* header */
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingBottom: 12,
            borderBottom: '1px solid ' + C.line
          }
        },
        h(Mark, { size: 24 }),
        h(
          'div',
          { style: { minWidth: 0, flex: 1 } },
          h('div', { style: { fontSize: 14, fontWeight: 700, lineHeight: 1.2 } }, text(name)),
          h(
            'div',
            { style: { fontSize: 11, color: C.dim, marginTop: 2 } },
            prettyPhone(a.from || (a.customers && a.customers.phone)) +
              ' · ' +
              text(e.store, 'CubeSmart')
          )
        ),
        h(Pill, {
          label: extendedAccess ? 'Extended access' : titleCase(e.account_status || 'tenant'),
          tone: extendedAccess ? 'warn' : 'good'
        })
      ),

      /* the play to make, before anything else */
      nba && nba.offer
        ? h('div', { style: { marginTop: 14 } }, h(NextBestAction, { nba: nba }))
        : null,

      /* live intelligence */
      h(IntelBlock, { intel: i }),

      /* what the AI wants from you */
      a.escalation_reason || a.ai_summary
        ? h(
            Section,
            { title: 'Why this call reached you' },
            h(
              Callout,
              { title: text(a.escalation_reason, 'Escalated by the voice agent') },
              text(a.ai_summary, 'No summary was provided.')
            ),
            h(
              'div',
              { style: { fontSize: 10, color: C.faint, marginTop: 6 } },
              'Handed over by ' + text(a.escalated_by, 'the voice AI')
            )
          )
        : null,

      /* blockers */
      cardExpired
        ? h(
            Section,
            { title: 'Needs resolving' },
            h(
              Callout,
              { title: 'Autopay declined', tone: 'bad' },
              text(e.card_on_file, 'Card on file has expired') +
                (e.failed_charge ? ' — ' + e.failed_charge + ' could not be processed.' : '')
            )
          )
        : null,

      /* lease */
      h(
        Section,
        { title: 'Unit & lease' },
        h(
          Grid,
          null,
          h(Field, { label: 'Unit type', value: text(e.unit_type) }),
          h(Field, {
            label: 'Account status',
            value: extendedAccess ? 'Extended access' : titleCase(e.account_status),
            tone: extendedAccess ? 'warn' : 'good'
          }),
          h(Field, {
            label: 'Access window starts',
            value: text(e.access_window_start),
            tone: extendedAccess ? 'warn' : undefined
          }),
          h(Field, {
            label: 'Access window ends',
            value: text(e.access_window_end),
            tone: extendedAccess ? 'warn' : undefined
          }),
          h(Field, {
            label: 'Access window length',
            value: e.access_window_days ? e.access_window_days + ' days' : '—'
          }),
          h(Field, {
            label: 'Autopay',
            value: cardExpired ? 'Expired' : titleCase(e.payment_status),
            tone: cardExpired ? 'bad' : 'good'
          }),
          h(Field, { label: 'Card on file', value: text(e.card_on_file) }),
          h(Field, {
            label: 'Failed charge',
            value: text(e.failed_charge, 'None'),
            tone: e.failed_charge ? 'bad' : undefined
          })
        )
      ),

      /* preferences */
      h(
        Section,
        { title: 'Preferences & activity' },
        h(
          Grid,
          null,
          h(Field, { label: 'Units reserved', value: text(e.units_booked, '0') }),
          h(Field, {
            label: 'Last rating given',
            value: e.last_staff_rating ? e.last_staff_rating + ' / 5' : '—'
          }),
          h(Field, { label: 'Usual supply order', value: text(e.usual_supply_order, 'None yet') }),
          h(Field, { label: 'Home store', value: text(e.store) })
        )
      ),

      /* reservation history */
      h(
        Section,
        { title: 'Reservation history' },
        history.length
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
              history.map(function (line, i) {
                var cancelled = String(line).toLowerCase().indexOf('cancelled') !== -1;
                return h(
                  'div',
                  {
                    key: 'ch' + i,
                    style: {
                      fontSize: 11.5,
                      color: cancelled ? C.faint : C.dim,
                      background: C.soft,
                      border: '1px solid ' + C.line,
                      borderRadius: 7,
                      padding: '6px 9px',
                      textDecoration: cancelled ? 'line-through' : 'none'
                    }
                  },
                  String(line)
                );
              })
            )
          : h('div', { style: { fontSize: 11.5, color: C.faint } }, 'Nothing on record yet.')
      ),

      /* transcript */
      transcript.length
        ? h(
            Section,
            { title: 'What she just said' },
            h(
              'div',
              {
                style: {
                  background: C.panel,
                  border: '1px solid ' + C.line,
                  borderRadius: 10,
                  padding: '10px 11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7
                }
              },
              transcript.map(function (line, i) {
                var s = String(line);
                var split = s.indexOf(':');
                var who = split > 0 ? s.slice(0, split) : '';
                var said = split > 0 ? s.slice(split + 1).trim() : s;
                var isAgent = who.toLowerCase().indexOf('voice ai') !== -1;
                return h(
                  'div',
                  { key: 'tr' + i },
                  who
                    ? h(
                        'div',
                        {
                          style: {
                            fontSize: 9,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: isAgent ? 'rgba(255,165,82,0.7)' : C.faint,
                            marginBottom: 2
                          }
                        },
                        who
                      )
                    : null,
                  h(
                    'div',
                    { style: { fontSize: 11.5, lineHeight: 1.5, color: isAgent ? C.dim : C.text } },
                    said
                  )
                );
              })
            )
          )
        : null,

      /* provenance */
      h(
        'div',
        {
          style: {
            marginTop: 16,
            paddingTop: 10,
            borderTop: '1px solid ' + C.line,
            fontSize: 9.5,
            color: C.faint,
            lineHeight: 1.6
          }
        },
        h('div', null, 'Twilio Memory profile: ' + text(e.memory_profile_id)),
        h('div', null, 'Task: ' + text(task && task.taskSid)),
        h('div', null, 'Delivered on the task attributes by the CubeSmart voice agent.')
      )
    );
  }

  /* ---------------- compact block for the Info tab ---------------- */

  function InfoSummary(props) {
    var task = props.task;
    var a = attrsOf(task);
    var e = cubesmartOf(a);
    if (!task || (!a.customerName && !a.name && !e.unit_type)) return null;

    var extendedAccess = String(e.account_status || '') === 'on-hold';
    var cardExpired = String(e.payment_status || '') === 'expired';
    var i = intelOf(a);
    var band = bandFor(i);
    var nba = i && i.next_best_action;

    return h(
      'div',
      { style: { fontFamily: FONT, padding: '10px 12px 4px' } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8
          }
        },
        h(Mark, { size: 16 }),
        h(
          'div',
          {
            style: {
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: C.orange
            }
          },
          'CubeSmart'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 } },
        h(Pill, { label: text(e.unit_type, 'Tenant'), tone: 'neutral' }),
        h(Pill, { label: extendedAccess ? 'Extended access' : 'Active', tone: extendedAccess ? 'warn' : 'good' }),
        cardExpired ? h(Pill, { label: 'Card expired', tone: 'bad' }) : null,
        band
          ? h(Pill, {
              label: band.label + ' ' + String(i.retention_risk_score),
              tone: band.tone
            })
          : null
      ),
      i.call_reason
        ? h(
            'div',
            { style: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'inherit' } },
            'Calling about: ' + String(i.call_reason)
          )
        : null,
      nba && nba.offer
        ? h(
            'div',
            {
              style: {
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 8,
                padding: '8px 9px',
                borderRadius: 8,
                background: 'rgba(255,122,26,0.12)',
                border: '1px solid rgba(255,165,82,0.35)'
              }
            },
            h(
              'div',
              {
                style: {
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: C.orange,
                  marginBottom: 3
                }
              },
              'Recommended'
            ),
            String(nba.offer)
          )
        : null,
      a.ai_summary
        ? h(
            'div',
            {
              style: {
                fontSize: 12,
                lineHeight: 1.5,
                color: 'inherit',
                opacity: 0.85
              }
            },
            String(a.ai_summary)
          )
        : null
    );
  }

  /* ---------------- plugin registration ---------------- */

  function CubeSmartTenantContextPlugin() {
    this.name = 'CubeSmartTenantContextPlugin';
    this.uniqueName = '${FLEX_PLUGIN_UNIQUE_NAME}';
    this.version = '${FLEX_PLUGIN_VERSION}';
    this.dependencies = {};
    if (w.console) w.console.log('[cubesmart-tenant-context] loading ' + this.version);
  }

  CubeSmartTenantContextPlugin.prototype.init = function (flex) {
    try {
      var withTask = Flex.withTaskContext || function (c) { return c; };
      var Panel = withTask(MemberPanel);
      var Summary = withTask(InfoSummary);

      if (flex.CRMContainer && flex.CRMContainer.Content) {
        flex.CRMContainer.Content.replace(h(Panel, { key: 'cubesmart-tenant-context' }));
      }

      if (flex.TaskInfoPanel && flex.TaskInfoPanel.Content) {
        flex.TaskInfoPanel.Content.add(h(Summary, { key: 'cubesmart-tenant-summary' }), {
          sortOrder: -1
        });
      }
    } catch (err) {
      if (w.console) w.console.error('[cubesmart-tenant-context] init failed', err);
    }
  };

  Flex.Plugins.init(CubeSmartTenantContextPlugin);
})();
`;
