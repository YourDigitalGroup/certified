/* @ds-bundle: {"format":4,"namespace":"Ds44iDigitalDesignSystem_019ddf","components":[{"name":"Button","sourcePath":"components/Button/Button.jsx"}],"sourceHashes":{"components/Button/Button.jsx":"6f10877231b3","ui_kits/website/CTA.jsx":"6a69fcd97d29","ui_kits/website/Capabilities.jsx":"c2109f5c5c65","ui_kits/website/Footer.jsx":"44f613b41d55","ui_kits/website/Hero.jsx":"b32e4ba7ab7e","ui_kits/website/Nav.jsx":"f51dd22201b9","ui_kits/website/Testimonial.jsx":"07f40e9ac985","ui_kits/website/WorkGrid.jsx":"0e3376f6c2b6","ui_kits/website/components.jsx":"dc406b8d403a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.Ds44iDigitalDesignSystem_019ddf = window.Ds44iDigitalDesignSystem_019ddf || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Button/Button.jsx
try { (() => {
const SIZES = {
  sm: {
    padding: '9px 16px',
    fontSize: 13
  },
  md: {
    padding: '13px 22px',
    fontSize: 15
  },
  lg: {
    padding: '16px 28px',
    fontSize: 16
  }
};
const VARIANTS = {
  primary: {
    background: 'var(--brand-blue)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-brand)'
  },
  secondary: {
    background: '#fff',
    color: 'var(--brand-ink)',
    border: '1px solid var(--border-strong)',
    boxShadow: 'var(--shadow-xs)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--brand-ink)',
    border: '1px solid transparent',
    boxShadow: 'none'
  },
  dark: {
    background: 'var(--brand-navy)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-sm)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  disabled = false,
  children = 'Button',
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const sz = SIZES[size] || SIZES.md;
  const base = VARIANTS[variant] || VARIANTS.primary;

  // hover / active shifts
  let bg = base.background;
  if (!disabled && variant === 'primary') {
    if (active) bg = 'var(--brand-blue-deep)';else if (hover) bg = 'var(--brand-blue-bright)';
  } else if (!disabled && variant === 'ghost' && (hover || active)) {
    bg = 'var(--brand-blue-soft)';
  } else if (!disabled && variant === 'secondary' && (hover || active)) {
    bg = 'var(--gray-50)';
  } else if (!disabled && variant === 'dark') {
    if (active) bg = 'var(--brand-navy-deep)';else if (hover) bg = 'var(--brand-navy-soft)';
  }
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: sz.fontSize,
    lineHeight: 1,
    padding: sz.padding,
    borderRadius: pill ? 9999 : 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    background: bg,
    color: base.color,
    border: base.border,
    boxShadow: hover && !disabled ? 'var(--shadow-md)' : base.boxShadow,
    transform: active && !disabled ? 'scale(0.98)' : 'scale(1)',
    transition: 'background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent'
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: style,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    onFocus: e => {
      e.currentTarget.style.boxShadow = 'var(--ring)';
    },
    onBlur: e => {
      e.currentTarget.style.boxShadow = base.boxShadow;
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button/Button.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/CTA.jsx
try { (() => {
/* global React */
const {
  useState: useStateCTA
} = React;
function CTA() {
  const [email, setEmail] = useStateCTA('');
  const [sent, setSent] = useStateCTA(false);
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    style: {
      padding: '0 32px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      background: 'var(--brand-blue)',
      color: '#fff',
      borderRadius: 36,
      padding: '80px 64px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-icon-white.svg",
    alt: "",
    style: {
      position: 'absolute',
      right: -80,
      bottom: -80,
      width: 480,
      opacity: 0.08
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      opacity: 0.7
    }
  }, "Now booking '25"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(36px, 4.5vw, 64px)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      fontWeight: 700,
      margin: '14px 0 0',
      maxWidth: 800,
      textWrap: 'balance'
    }
  }, "Got something to ship? ", /*#__PURE__*/React.createElement("br", null), "Let's talk scope."), !sent ? /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (email) setSent(true);
    },
    style: {
      marginTop: 40,
      display: 'flex',
      gap: 12,
      maxWidth: 560,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "you@company.com",
    style: {
      flex: 1,
      minWidth: 240,
      fontFamily: 'inherit',
      fontSize: 16,
      background: 'rgba(255,255,255,0.12)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.24)',
      borderRadius: 14,
      padding: '16px 20px',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      background: '#fff',
      color: 'var(--brand-blue)',
      fontFamily: 'inherit',
      fontWeight: 600,
      fontSize: 16,
      border: 0,
      borderRadius: 14,
      padding: '16px 28px',
      cursor: 'pointer'
    }
  }, "Get in touch \u2192")) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      fontSize: 18,
      background: 'rgba(255,255,255,0.12)',
      padding: '20px 24px',
      borderRadius: 14,
      display: 'inline-block'
    }
  }, "\u2713 Got it. We'll write back within two business days."))));
}
window.CTA = CTA;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/CTA.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Capabilities.jsx
try { (() => {
/* global React */

const CAPS = [{
  n: '01',
  t: 'Strategy',
  d: 'Positioning, naming, narrative. We figure out what to build before we build it.'
}, {
  n: '02',
  t: 'Brand & Identity',
  d: 'Marks, systems, motion, and the rules to keep them sharp.'
}, {
  n: '03',
  t: 'Product Design',
  d: 'End-to-end UX/UI for the surfaces your customers actually use.'
}, {
  n: '04',
  t: 'Engineering',
  d: 'Web and product engineering — shipped, not just designed.'
}];
function Capabilities() {
  return /*#__PURE__*/React.createElement("section", {
    id: "studio",
    style: {
      padding: '120px 32px',
      background: 'var(--bg-sunken)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 64,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--brand-blue)'
    }
  }, "What we do"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(36px, 4vw, 56px)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      fontWeight: 700,
      margin: '12px 0 20px',
      textWrap: 'balance'
    }
  }, "Four disciplines. ", /*#__PURE__*/React.createElement("br", null), "One team."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      color: 'var(--fg-2)',
      lineHeight: 1.45,
      maxWidth: 460,
      textWrap: 'pretty'
    }
  }, "We work as a single, senior team across the lifecycle \u2014 so the brief, the brand, the product, and the launch site all line up.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, CAPS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.n,
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)',
      padding: 32,
      display: 'flex',
      gap: 24,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--brand-blue)',
      fontWeight: 600,
      paddingTop: 4
    }
  }, c.n), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.01em'
    }
  }, c.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--fg-2)',
      marginTop: 8,
      lineHeight: 1.5
    }
  }, c.d))))))));
}
window.Capabilities = Capabilities;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Capabilities.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Footer.jsx
try { (() => {
/* global React */

function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--brand-ink)',
      color: '#fff',
      padding: '80px 32px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr',
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-full-white.svg",
    alt: "44i Digital",
    style: {
      height: 32
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--dark-fg-2)',
      maxWidth: 320,
      marginTop: 20,
      lineHeight: 1.5
    }
  }, "44i Digital \u2014 a senior, end-to-end studio for teams who want it sharp.")), [['Studio', ['About', 'Process', 'Careers', 'Press']], ['Work', ['Selected', 'Brand', 'Product', 'Web']], ['Contact', ['Start a project', 'hello@44i.com', 'New York · Austin']]].map(([h, items]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--dark-fg-3)'
    }
  }, h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      padding: 0,
      margin: '16px 0 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, items.map(i => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      fontSize: 14,
      color: 'var(--dark-fg-2)'
    }
  }, i)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 64,
      paddingTop: 24,
      borderTop: '1px solid #1F2937',
      fontSize: 12,
      color: 'var(--dark-fg-3)'
    }
  }, /*#__PURE__*/React.createElement("div", null, "\xA9 2025 44i Digital II. All rights reserved."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("span", null, "Privacy"), /*#__PURE__*/React.createElement("span", null, "Terms"), /*#__PURE__*/React.createElement("span", null, "Cookies")))));
}
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Hero.jsx
try { (() => {
/* global React */

function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      background: 'var(--brand-ink)',
      color: '#fff',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-icon-white.svg",
    alt: "",
    style: {
      position: 'absolute',
      right: -120,
      top: -60,
      width: 720,
      opacity: 0.04,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '120px 32px 140px',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--brand-blue-glow)'
    }
  }, "The 44i Studio \xB7 Est. 2018"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(48px, 7vw, 104px)',
      lineHeight: 1.02,
      letterSpacing: '-0.025em',
      fontWeight: 700,
      margin: '24px 0 0',
      maxWidth: 1000,
      textWrap: 'balance'
    }
  }, "National digital, ", /*#__PURE__*/React.createElement("br", null), "built sharp."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 22,
      lineHeight: 1.45,
      color: 'var(--dark-fg-2)',
      maxWidth: 640,
      margin: '32px 0 0',
      textWrap: 'pretty'
    }
  }, "Strategy, design, and engineering \u2014 under one roof. We build the brand, the product, and the site that ships it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 44,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'var(--brand-blue)',
      color: '#fff',
      fontWeight: 600,
      fontSize: 16,
      padding: '16px 28px',
      border: 0,
      borderRadius: 14,
      boxShadow: 'var(--shadow-brand)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, "Start a project \u2192"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      color: '#fff',
      fontWeight: 600,
      fontSize: 16,
      padding: '16px 22px',
      border: '1px solid #2A3340',
      borderRadius: 14,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "Watch the reel")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 64,
      marginTop: 96,
      paddingTop: 32,
      borderTop: '1px solid #1F2937',
      color: 'var(--dark-fg-2)'
    }
  }, [['80+', 'Brands shipped'], ['12 wk', 'Average engagement'], ['7 yrs', 'Building national digital']].map(([n, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 38,
      fontWeight: 700,
      color: '#fff',
      letterSpacing: '-0.02em'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      marginTop: 4
    }
  }, l))))));
}
window.Hero = Hero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Nav.jsx
try { (() => {
/* global React */
const {
  useState
} = React;
function Nav() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-full.svg",
    alt: "44i Digital",
    style: {
      height: 26
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 28,
      fontSize: 14,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#work",
    style: {
      color: 'var(--fg-1)'
    }
  }, "Work"), /*#__PURE__*/React.createElement("a", {
    href: "#studio",
    style: {
      color: 'var(--fg-2)'
    }
  }, "Studio"), /*#__PURE__*/React.createElement("a", {
    href: "#journal",
    style: {
      color: 'var(--fg-2)'
    }
  }, "Journal"), /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    style: {
      color: 'var(--fg-2)'
    }
  }, "Contact")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "\u25CF Now booking '25"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'var(--brand-blue)',
      color: '#fff',
      fontWeight: 600,
      fontSize: 13,
      padding: '10px 18px',
      border: 0,
      borderRadius: 9999,
      boxShadow: 'var(--shadow-brand)',
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "Start a project"))));
}
window.Nav = Nav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Testimonial.jsx
try { (() => {
/* global React */

function Testimonial() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '120px 32px',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 980,
      margin: '0 auto',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 80,
      color: 'var(--brand-blue-soft)',
      lineHeight: 1,
      fontFamily: 'serif'
    }
  }, "\""), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      fontSize: 'clamp(28px, 3vw, 44px)',
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
      fontWeight: 600,
      color: 'var(--fg-1)',
      textWrap: 'balance'
    }
  }, "They moved like a senior in-house team. Brand, product, and site shipped together \u2014 and the launch number beat plan in week one."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      background: 'var(--gray-200)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15
    }
  }, "Maya Okafor"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "Chief Brand Officer \xB7 Atlas")))));
}
window.Testimonial = Testimonial;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Testimonial.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WorkGrid.jsx
try { (() => {
/* global React */
const {
  useState: useStateWG
} = React;
const WORK = [{
  id: 1,
  title: 'Atlas',
  tag: 'Brand · Product · Web',
  year: "'25",
  category: 'Brand',
  accent: 'linear-gradient(135deg,#4B9BD7,#2F6FA8)'
}, {
  id: 2,
  title: 'Northwind Health',
  tag: 'Product Design',
  year: "'25",
  category: 'Product',
  accent: 'linear-gradient(135deg,#1A1F26,#303840)'
}, {
  id: 3,
  title: 'Field & Co.',
  tag: 'Identity',
  year: "'24",
  category: 'Brand',
  accent: 'linear-gradient(135deg,#E89923,#B6711A)'
}, {
  id: 4,
  title: 'Quartet OS',
  tag: 'Web · Engineering',
  year: "'24",
  category: 'Web',
  accent: 'linear-gradient(135deg,#16A34A,#0F7A37)'
}, {
  id: 5,
  title: 'Salt Pictures',
  tag: 'Brand · Motion',
  year: "'24",
  category: 'Motion',
  accent: 'linear-gradient(135deg,#0B0F14,#1A1F26)'
}, {
  id: 6,
  title: 'Halcyon',
  tag: 'Product · Web',
  year: "'23",
  category: 'Product',
  accent: 'linear-gradient(135deg,#639AD1,#4B9BD7)'
}];
const FILTERS = ['All work', 'Brand', 'Product', 'Web', 'Motion'];
function WorkGrid() {
  const [filter, setFilter] = useStateWG('All work');
  const items = filter === 'All work' ? WORK : WORK.filter(w => w.category === filter);
  return /*#__PURE__*/React.createElement("section", {
    id: "work",
    style: {
      padding: '120px 32px',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 48,
      flexWrap: 'wrap',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--brand-blue)'
    }
  }, "Selected work"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(36px, 4vw, 56px)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      fontWeight: 700,
      margin: '12px 0 0',
      maxWidth: 720
    }
  }, "The work, '23 \u2192 '25.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, FILTERS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setFilter(f),
    style: {
      background: filter === f ? 'var(--brand-ink)' : 'transparent',
      color: filter === f ? '#fff' : 'var(--fg-1)',
      border: filter === f ? '1px solid var(--brand-ink)' : '1px solid var(--border)',
      fontSize: 13,
      fontWeight: 500,
      padding: '8px 14px',
      borderRadius: 9999,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 180ms var(--ease-out)'
    }
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
      gap: 24
    }
  }, items.map(w => /*#__PURE__*/React.createElement("article", {
    key: w.id,
    style: {
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      cursor: 'pointer',
      transition: 'all 240ms var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '4/3',
      background: w.accent,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 16,
      left: 16,
      background: 'rgba(255,255,255,0.92)',
      color: 'var(--fg-1)',
      fontSize: 12,
      fontWeight: 600,
      padding: '5px 10px',
      borderRadius: 9999
    }
  }, w.year)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: '-0.01em'
    }
  }, w.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      marginTop: 2
    }
  }, w.tag)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      color: 'var(--fg-3)'
    }
  }, "\u2197")))))));
}
window.WorkGrid = WorkGrid;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WorkGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/components.jsx
try { (() => {
// 44i Digital — Website UI Kit components
// Loaded as Babel JSX. Components are exposed on window for cross-file sharing.

const {
  useState
} = React;
function TopNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return /*#__PURE__*/React.createElement("header", {
    className: `nav ${scrolled ? 'nav-scrolled' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "nav-brand",
    href: "#"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-full.svg",
    alt: "44i Digital"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "nav-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#work",
    className: "nav-link nav-link-active"
  }, "Work"), /*#__PURE__*/React.createElement("a", {
    href: "#studio",
    className: "nav-link"
  }, "Studio"), /*#__PURE__*/React.createElement("a", {
    href: "#approach",
    className: "nav-link"
  }, "Approach"), /*#__PURE__*/React.createElement("a", {
    href: "#journal",
    className: "nav-link"
  }, "Journal")), /*#__PURE__*/React.createElement("div", {
    className: "nav-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-status"
  }, "Now booking '25 \u2192"), /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    className: "btn btn-primary btn-sm"
  }, "Start a project"))));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "44i Digital \xB7 Studio for national brands"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "Built for the work", /*#__PURE__*/React.createElement("br", null), "that matters."), /*#__PURE__*/React.createElement("p", {
    className: "hero-lead"
  }, "We're a small studio doing strategy, design, and engineering for ambitious teams. End to end. Under one roof."), /*#__PURE__*/React.createElement("div", {
    className: "hero-cta"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#work",
    className: "btn btn-primary"
  }, "See selected work \u2192"), /*#__PURE__*/React.createElement("a", {
    href: "#reel",
    className: "btn btn-ghost"
  }, "\u25B6 Watch the reel \xB7 1:24")), /*#__PURE__*/React.createElement("div", {
    className: "hero-marquee"
  }, /*#__PURE__*/React.createElement("span", {
    className: "marquee-label"
  }, "Trusted by"), /*#__PURE__*/React.createElement("div", {
    className: "marquee-row"
  }, /*#__PURE__*/React.createElement("span", null, "NORTHWIND"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "ATLAS"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "FIELD & CO"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "HALCYON"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "MERIDIAN"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "OAKLINE")))));
}
function FeaturedWork() {
  const items = [{
    tag: 'Brand · Web · Product',
    title: 'Atlas, end to end.',
    meta: 'Atlas Logistics · 2025',
    tone: 'dark'
  }, {
    tag: 'Brand · Identity',
    title: 'A new chapter for Halcyon.',
    meta: 'Halcyon Hotels · 2025',
    tone: 'light'
  }, {
    tag: 'Product Design',
    title: 'Shipping less, on purpose.',
    meta: 'Northwind · 2024',
    tone: 'blue'
  }, {
    tag: 'Web · Motion',
    title: 'Field & Co — the redesign.',
    meta: 'Field & Co · 2024',
    tone: 'light'
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "work",
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Selected work"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "A few things we're proud of."), /*#__PURE__*/React.createElement("a", {
    href: "#all",
    className: "section-link"
  }, "All work \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "work-grid"
  }, items.map((it, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: "#",
    className: `work-card work-${it.tone}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "work-media"
  }, /*#__PURE__*/React.createElement("div", {
    className: "work-media-inner"
  })), /*#__PURE__*/React.createElement("div", {
    className: "work-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow eyebrow-soft"
  }, it.tag), /*#__PURE__*/React.createElement("div", {
    className: "work-title"
  }, it.title), /*#__PURE__*/React.createElement("div", {
    className: "work-sub"
  }, it.meta)))))));
}
function Capabilities() {
  const caps = [{
    n: '01',
    title: 'Strategy',
    body: 'Brand positioning, naming, and the hard scoping work that comes before pixels.'
  }, {
    n: '02',
    title: 'Design',
    body: 'Identity systems, marketing, and product. Built to scale, not just to launch.'
  }, {
    n: '03',
    title: 'Engineering',
    body: 'Production sites and apps. Type-safe, fast, accessible — the table stakes.'
  }, {
    n: '04',
    title: 'Motion',
    body: 'Reels, brand films, and product motion. We treat it as design, not garnish.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "approach",
    className: "section section-alt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "What we do"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Strategy, design, engineering \u2014 under one roof.")), /*#__PURE__*/React.createElement("div", {
    className: "caps-grid"
  }, caps.map(c => /*#__PURE__*/React.createElement("div", {
    className: "cap-card",
    key: c.n
  }, /*#__PURE__*/React.createElement("div", {
    className: "cap-num"
  }, c.n), /*#__PURE__*/React.createElement("div", {
    className: "cap-title"
  }, c.title), /*#__PURE__*/React.createElement("div", {
    className: "cap-body"
  }, c.body))))));
}
function Stats() {
  return /*#__PURE__*/React.createElement("section", {
    className: "stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container stats-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, "12"), /*#__PURE__*/React.createElement("div", {
    className: "stat-lbl"
  }, "years shipping")), /*#__PURE__*/React.createElement("div", {
    className: "stat-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, "80", /*#__PURE__*/React.createElement("span", null, "+")), /*#__PURE__*/React.createElement("div", {
    className: "stat-lbl"
  }, "national brands")), /*#__PURE__*/React.createElement("div", {
    className: "stat-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, "9"), /*#__PURE__*/React.createElement("div", {
    className: "stat-lbl"
  }, "people, no fluff")), /*#__PURE__*/React.createElement("div", {
    className: "stat-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, "'13"), /*#__PURE__*/React.createElement("div", {
    className: "stat-lbl"
  }, "est."))));
}
function Quote() {
  return /*#__PURE__*/React.createElement("section", {
    className: "quote"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Testimonial"), /*#__PURE__*/React.createElement("blockquote", {
    className: "quote-body"
  }, "\"44i feels less like a vendor and more like the senior team you wish you had. Sharp, decisive, and they actually ship.\""), /*#__PURE__*/React.createElement("div", {
    className: "quote-credit"
  }, /*#__PURE__*/React.createElement("div", {
    className: "quote-avatar"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "quote-name"
  }, "Maya Halford"), /*#__PURE__*/React.createElement("div", {
    className: "quote-role"
  }, "VP Brand \xB7 Atlas Logistics")))));
}
function Journal() {
  const posts = [{
    date: 'Mar 12, 2025',
    read: '6 min',
    title: 'On scope as a creative tool.',
    kicker: 'Notes from the studio'
  }, {
    date: 'Feb 04, 2025',
    read: '4 min',
    title: 'A small studio playbook for shipping in weeks, not quarters.',
    kicker: 'Practice'
  }, {
    date: 'Jan 18, 2025',
    read: '8 min',
    title: 'What "national digital" actually means in 2025.',
    kicker: 'Industry'
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "journal",
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Journal"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Working notes."), /*#__PURE__*/React.createElement("a", {
    href: "#all-posts",
    className: "section-link"
  }, "All posts \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "journal-list"
  }, posts.map((p, i) => /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "journal-row",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "journal-date"
  }, p.date), /*#__PURE__*/React.createElement("div", {
    className: "journal-title"
  }, p.title), /*#__PURE__*/React.createElement("div", {
    className: "journal-kicker"
  }, p.kicker), /*#__PURE__*/React.createElement("div", {
    className: "journal-read"
  }, p.read, " \u2192"))))));
}
function ContactCTA() {
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    className: "cta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container cta-inner"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow eyebrow-on-dark"
  }, "Get in touch"), /*#__PURE__*/React.createElement("h2", {
    className: "cta-title"
  }, "Have a project in mind?"), /*#__PURE__*/React.createElement("p", {
    className: "cta-lead"
  }, "Tell us about scope, timeline, and ambition. We'll send back honest thoughts within two business days.")), /*#__PURE__*/React.createElement("form", {
    className: "cta-form",
    onSubmit: e => {
      e.preventDefault();
      alert('Thanks — we\'ll be in touch.');
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", null, "Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Jamie Halford"
  })), /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", null, "Email"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "jamie@company.com"
  })), /*#__PURE__*/React.createElement("label", {
    className: "field field-full"
  }, /*#__PURE__*/React.createElement("span", null, "Tell us about the project"), /*#__PURE__*/React.createElement("textarea", {
    rows: 3,
    placeholder: "A sentence or two on scope and timing."
  })), /*#__PURE__*/React.createElement("div", {
    className: "cta-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "btn btn-primary"
  }, "Send brief \u2192"), /*#__PURE__*/React.createElement("span", {
    className: "cta-hint"
  }, "or email ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:hello@44i.digital"
  }, "hello@44i.digital"))))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container footer-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-full-white.svg",
    alt: "44i Digital"
  }), /*#__PURE__*/React.createElement("p", {
    className: "footer-blurb"
  }, "A studio for teams who want it sharp.")), /*#__PURE__*/React.createElement("div", {
    className: "footer-cols"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-head"
  }, "Studio"), /*#__PURE__*/React.createElement("a", null, "Work"), /*#__PURE__*/React.createElement("a", null, "About"), /*#__PURE__*/React.createElement("a", null, "Journal"), /*#__PURE__*/React.createElement("a", null, "Contact")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-head"
  }, "Services"), /*#__PURE__*/React.createElement("a", null, "Strategy"), /*#__PURE__*/React.createElement("a", null, "Design"), /*#__PURE__*/React.createElement("a", null, "Engineering"), /*#__PURE__*/React.createElement("a", null, "Motion")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-head"
  }, "Elsewhere"), /*#__PURE__*/React.createElement("a", null, "Vimeo \u2197"), /*#__PURE__*/React.createElement("a", null, "Instagram \u2197"), /*#__PURE__*/React.createElement("a", null, "LinkedIn \u2197"), /*#__PURE__*/React.createElement("a", null, "Are.na \u2197")))), /*#__PURE__*/React.createElement("div", {
    className: "footer-base container"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2025 44i Digital. All rights reserved."), /*#__PURE__*/React.createElement("span", null, "Brooklyn \xB7 Toronto \xB7 Remote.")));
}
Object.assign(window, {
  TopNav,
  Hero,
  FeaturedWork,
  Capabilities,
  Stats,
  Quote,
  Journal,
  ContactCTA,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/components.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

})();
