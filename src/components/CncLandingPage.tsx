import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Mail,
  MessageSquare,
  Clock,
  FileCheck2,
  ShieldCheck,
  Ruler,
} from 'lucide-react';

import heroCncImg from '../assets/images/hero_cnc_machining_1795486999541.jpg';
import partBracketImg from '../assets/images/part_aerospace_bracket_1795487000311.jpg';
import partShaftImg from '../assets/images/part_stainless_shaft_1795486999946.jpg';
import partTitaniumImg from '../assets/images/part_medical_titanium_1795487001152.jpg';
import facilityCmmImg from '../assets/images/facility_cmm_inspection_1795487001508.jpg';

type CapabilityGroup = 'all' | 'machining' | 'fabrication';
type ProductMaterial = 'all' | 'aluminum' | 'stainless' | 'titanium';

interface CapabilityItem {
  id: string;
  number: string;
  group: 'machining' | 'fabrication';
  title: string;
  equipment: string;
  description: string;
  tolerance: string;
  envelope: string;
  leadTime: string;
}

interface ProductItem {
  id: string;
  materialKey: 'aluminum' | 'stainless' | 'titanium';
  title: string;
  industry: string;
  material: string;
  tolerance: string;
  process: string;
  finish: string;
  summary: string;
  image: string;
  alt: string;
}

interface RfqFormState {
  name: string;
  email: string;
  company: string;
  process: string;
  material: string;
  tolerance: string;
  quantity: string;
  notes: string;
}

const CAPABILITIES: CapabilityItem[] = [
  {
    id: '5-axis-milling',
    number: '01.',
    group: 'machining',
    title: '5-Axis Milling',
    equipment: 'DMG MORI & Mazak Simultaneous 5-Axis Centers',
    description:
      'Single-setup machining for compound angles, deep impellers, undercuts, and complex structural aerospace housings with zero datum shift.',
    tolerance: '±0.005 mm',
    envelope: '1,200 × 850 × 650 mm',
    leadTime: '3–5 Days',
  },
  {
    id: 'cnc-turning',
    number: '02.',
    group: 'machining',
    title: 'CNC Turning',
    equipment: 'Citizen Swiss-Type & Multi-Axis Mill-Turn Lathes',
    description:
      'High-concentricity bar-fed production for precision shafts, valve spools, custom fasteners, and live-tooled cross-drilled couplings.',
    tolerance: '±0.004 mm',
    envelope: 'Ø2 – Ø380 × 900 mm',
    leadTime: '3–5 Days',
  },
  {
    id: 'sheet-metal',
    number: '03.',
    group: 'fabrication',
    title: 'Sheet Metal Fabrication',
    equipment: 'Fiber Laser Cutting, CNC Turret Punch & Press Brakes',
    description:
      'Clean-edge enclosures, chassis assemblies, EMI shielding brackets, and precision TIG/laser welded industrial sub-assemblies.',
    tolerance: '±0.050 mm',
    envelope: '2,500 × 1,250 mm',
    leadTime: '5–7 Days',
  },
  {
    id: 'surface-finishing',
    number: '04.',
    group: 'fabrication',
    title: 'Surface Finishing',
    equipment: 'In-House Bead Blast & Qualified NADCAP Partner Lines',
    description:
      'MIL-A-8625 Type II/III anodizing, passivation per ASTM A967, electroless nickel plating, chromate conversion, and fiber laser part marking.',
    tolerance: 'Ra 0.2 µm',
    envelope: 'Batch & Rack Lines',
    leadTime: '+1–2 Days',
  },
];

const FEATURED_PRODUCTS: ProductItem[] = [
  {
    id: 'aerospace-brackets',
    materialKey: 'aluminum',
    title: 'Aerospace Aluminum Brackets',
    industry: 'Aerospace & UAV Structures',
    material: 'Al 7075-T6 / 6061-T6',
    tolerance: '±0.005 mm',
    process: '5-Axis Milling',
    finish: 'Bead Blast + Type III Hard Anodize',
    summary:
      'Thin-wall pocketed structural rib brackets machined from stress-relieved billet plate with full datum flatness control.',
    image: partBracketImg,
    alt: 'Precision 5-axis CNC machined 7075-T6 aerospace aluminum structural bracket with weight-saving pockets',
  },
  {
    id: 'stainless-shafts',
    materialKey: 'stainless',
    title: 'Stainless Steel Shafts',
    industry: 'Fluid Control & Robotics',
    material: 'SS 316L / 17-4PH H900',
    tolerance: '±0.004 mm',
    process: 'Swiss CNC Turning',
    finish: 'Centerless Ground + Passivation',
    summary:
      'Concentric multi-stepped rotor shafts, micro-threaded valve stems, and cross-ported hydraulic sleeves with Ra 0.4 µm bearing journals.',
    image: partShaftImg,
    alt: 'CNC Swiss-turned 316L stainless steel stepped shafts and precision threaded hydraulic sleeves',
  },
  {
    id: 'medical-titanium',
    materialKey: 'titanium',
    title: 'Medical Titanium Components',
    industry: 'Surgical & Diagnostic Devices',
    material: 'Ti-6Al-4V ELI (Grade 5)',
    tolerance: '±0.005 mm',
    process: '5-Axis Mill-Turn',
    finish: 'Electropolished & Passivated',
    summary:
      'Burr-free surgical instrument housings, endoscopic couplings, and bone-fixation hardware inspected under 40x optical magnification.',
    image: partTitaniumImg,
    alt: 'Precision 5-axis machined Ti-6Al-4V titanium surgical instrument housings and micro-milled components',
  },
  {
    id: 'optical-manifolds',
    materialKey: 'aluminum',
    title: 'Optical & Sensor Housings',
    industry: 'Semiconductor & Photonics',
    material: 'Al 6061-T651',
    tolerance: '±0.005 mm',
    process: '5-Axis Milling',
    finish: 'Matte Black Anodize',
    summary:
      'Light-tight monolithic sensor enclosures and thermal cold plates engineered for leak-tested vacuum and metrology assemblies.',
    image: heroCncImg,
    alt: 'Complex 5-axis machined aluminum manifold housing mounted inside precision CNC rotary trunnion',
  },
];

const QUALITY_STEPS = [
  {
    step: '01.',
    title: 'Incoming Material Verification & Mill Certs',
    detail:
      'Every aluminum, stainless, and titanium bar or billet arrives with EN 10204 3.1 mill test certificates and XRF alloy verification prior to cutting.',
  },
  {
    step: '02.',
    title: 'First Article Inspection (AS9102 FAI)',
    detail:
      'Initial off-tool components undergo full ballooned drawing verification before batch production release, with digital FAI reports sent on request.',
  },
  {
    step: '03.',
    title: '100% Bridge CMM & Optical Metrology',
    detail:
      'Critical GD&T true position, concentricity, and profile tolerances are measured inside our 20 °C climate-controlled inspection lab.',
  },
  {
    step: '04.',
    title: 'Export-Grade Protection & Lot Traceability',
    detail:
      'Parts are ultrasonically cleaned, individually VCI-wrapped or placed in custom foam trays, and shipped via DHL/FedEx Air or sea freight worldwide.',
  },
];

const INITIAL_FORM: RfqFormState = {
  name: '',
  email: '',
  company: '',
  process: '5-Axis Milling',
  material: 'Aluminum 6061-T6 / 7075-T6',
  tolerance: '±0.005 mm (Precision)',
  quantity: '10 – 50 pcs (Prototype / Pilot)',
  notes: '',
};

function ResilientImage({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center bg-slate-900 p-6 text-center text-slate-300`}
      >
        <Ruler className="mb-2 h-7 w-7 text-sky-400" aria-hidden="true" />
        <span className="text-sm font-medium text-white">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function CncLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [capFilter, setCapFilter] = useState<CapabilityGroup>('all');
  const [partFilter, setPartFilter] = useState<ProductMaterial>('all');

  // Inline contact RFQ form state
  const [inlineForm, setInlineForm] = useState<RfqFormState>(INITIAL_FORM);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSubmittedId, setInlineSubmittedId] = useState<string | null>(null);

  // Modal RFQ state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<RfqFormState>(INITIAL_FORM);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmittedId, setModalSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openQuoteModal = (preset?: Partial<RfqFormState>) => {
    setModalSubmittedId(null);
    setModalError(null);
    setModalForm((prev) => ({
      ...prev,
      ...preset,
    }));
    setModalOpen(true);
    setMobileMenuOpen(false);
  };

  const validateRfq = (form: RfqFormState): string | null => {
    if (!form.name.trim()) return 'Please enter your full name.';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      return 'Please enter a valid business email address.';
    }
    if (!form.company.trim()) return 'Please enter your company or organization name.';
    return null;
  };

  const handleInlineSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateRfq(inlineForm);
    if (err) {
      setInlineError(err);
      return;
    }
    setInlineError(null);
    const refId = `RFQ-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setInlineSubmittedId(refId);
  };

  const handleModalSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateRfq(modalForm);
    if (err) {
      setModalError(err);
      return;
    }
    setModalError(null);
    const refId = `RFQ-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setModalSubmittedId(refId);
  };

  const visibleCapabilities = CAPABILITIES.filter((c) =>
    capFilter === 'all' ? true : c.group === capFilter
  );

  const visibleProducts = FEATURED_PRODUCTS.filter((p) =>
    partFilter === 'all' ? true : p.materialKey === partFilter
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* TOP BAR: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#home"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ApexForge Precision
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"
          >
            <a
              href="#home"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
            >
              Home
            </a>
            <a
              href="#capabilities"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
            >
              Capabilities
            </a>
            <a
              href="#products"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
            >
              Products
            </a>
            <a
              href="#quality"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
            >
              Quality
            </a>
            <a
              href="#contact"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openQuoteModal()}
              className="hidden rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 whitespace-nowrap shrink-0 sm:inline-flex"
            >
              Request a Quote
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Home
              </a>
              <a href="#capabilities" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Capabilities
              </a>
              <a href="#products" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Products
              </a>
              <a href="#quality" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Quality
              </a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Contact
              </a>
              <button
                type="button"
                onClick={() => openQuoteModal()}
                className="mt-2 w-full rounded-md bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-sky-700"
              >
                Request a Quote
              </button>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* SECTION 1: HERO */}
        <section id="home" className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0">
            <ResilientImage
              src={heroCncImg}
              alt="5-axis CNC machining center cutting precision aerospace aluminum housing"
              fallbackTitle="5-Axis CNC Machining Facility"
              className="h-full w-full object-cover object-center opacity-55"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(95deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.82) 52%, rgba(15, 23, 42, 0.45) 100%)',
              }}
              aria-hidden="true"
            />
          </div>

          <div className="relative mx-auto max-w-[1200px] px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-medium tracking-wider text-sky-300 sm:text-sm">
                ISO 9001:2015 Certified · Tolerances down to ±0.005mm · 3-Day Rapid Prototyping
              </p>
              <h1 className="font-display mt-4 text-[clamp(2.15rem,4vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-white">
                High Precision Custom CNC Machining Services &amp; Rapid Prototyping
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
                Direct contract manufacturer serving North American and European OEM engineering
                teams. From single 5-axis prototypes to serialized multi-axis production runs with
                full CMM dimensional inspection.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => openQuoteModal()}
                  className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
                >
                  <span>Get an Instant Quote</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href="#capabilities"
                  className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 whitespace-nowrap shrink-0"
                >
                  Explore Capabilities
                </a>
              </div>
            </div>

            {/* Full-width 4-column benchmark bar below hero */}
            <div className="mt-16 grid grid-cols-2 gap-6 border-t border-white/15 pt-8 lg:grid-cols-4">
              <div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  ±0.005 mm
                </div>
                <div className="mt-1 text-sm text-slate-300">Tightest machining tolerance</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  3 Days
                </div>
                <div className="mt-1 text-sm text-slate-300">Rapid prototype turnaround</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  42+
                </div>
                <div className="mt-1 text-sm text-slate-300">5-Axis &amp; Swiss CNC centers</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  50+
                </div>
                <div className="mt-1 text-sm text-slate-300">Certified metals &amp; engineering plastics</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: CORE CAPABILITIES */}
        <section id="capabilities" className="scroll-mt-20 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wider text-sky-700 uppercase">
                  Core Capabilities
                </p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Multi-Axis Machining, Turning &amp; Certified Finishing
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  Integrated shop-floor capacity engineered to eliminate vendor handoffs and cut
                  total lead times from CAD upload to inspected delivery.
                </p>
              </div>

              <div
                role="group"
                aria-label="Filter machining capabilities"
                className="inline-flex w-fit items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                {(
                  [
                    ['all', 'All Processes'],
                    ['machining', 'Milling & Turning'],
                    ['fabrication', 'Sheet & Finishing'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCapFilter(key)}
                    className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      capFilter === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {visibleCapabilities.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-7 transition-colors hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-mono text-sm font-semibold tabular-nums text-sky-700">
                        {item.number}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{item.equipment}</span>
                    </div>
                    <h3 className="font-display mt-3 text-xl font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <dl className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <dt className="text-slate-500">Tolerance</dt>
                        <dd className="font-mono mt-1 font-semibold tabular-nums text-slate-900">
                          {item.tolerance}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Max Work Envelope</dt>
                        <dd className="font-mono mt-1 font-semibold tabular-nums text-slate-900">
                          {item.envelope}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Standard Lead</dt>
                        <dd className="font-mono mt-1 font-semibold tabular-nums text-slate-900">
                          {item.leadTime}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => openQuoteModal({ process: item.title })}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 transition-colors hover:text-sky-800 whitespace-nowrap"
                      >
                        <span>Quote {item.title}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: FEATURED PRODUCTS */}
        <section
          id="products"
          className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-20 lg:py-24"
        >
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wider text-sky-700 uppercase">
                  Featured Components
                </p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Production-Proven Parts Across Regulated Industries
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  Representative custom components shipped monthly under strict NDA, material
                  traceability, and zero-defect sampling plans.
                </p>
              </div>

              <div
                role="group"
                aria-label="Filter featured products by alloy"
                className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1"
              >
                {(
                  [
                    ['all', 'All Alloys'],
                    ['aluminum', 'Aluminum'],
                    ['stainless', 'Stainless Steel'],
                    ['titanium', 'Titanium'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPartFilter(key)}
                    className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      partFilter === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {visibleProducts.map((part) => (
                <article
                  key={part.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
                    <ResilientImage
                      src={part.image}
                      alt={part.alt}
                      fallbackTitle={part.title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{part.industry}</span>
                      <span aria-hidden="true">·</span>
                      <span>{part.process}</span>
                    </div>

                    <h3 className="font-display mt-2 text-xl font-bold text-slate-900">
                      {part.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{part.summary}</p>

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-500">Material</dt>
                        <dd className="font-mono mt-0.5 font-semibold text-slate-900">
                          {part.material}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Tolerance</dt>
                        <dd className="font-mono mt-0.5 font-semibold tabular-nums text-slate-900">
                          {part.tolerance}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-slate-500">Finish</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{part.finish}</dd>
                      </div>
                    </dl>

                    <div className="mt-auto pt-6">
                      <button
                        type="button"
                        onClick={() =>
                          openQuoteModal({
                            process: part.process,
                            material: part.material,
                            tolerance: part.tolerance,
                            notes: `Reference component: ${part.title} (${part.finish})`,
                          })
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-sky-600 hover:text-sky-700"
                      >
                        <span>Request Similar Part Quote</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: QUALITY ASSURANCE & METROLOGY */}
        <section id="quality" className="scroll-mt-20 bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="grid items-stretch gap-12 lg:grid-cols-12">
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-sky-700 uppercase">
                    Quality Assurance &amp; Metrology
                  </p>
                  <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    Verified Dimensional Inspection Before Every Shipment
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-slate-600">
                    Quality is built into our G-code verification and in-process probing rather
                    than inspected only at final pack-out. Virtual factory audits and live CMM
                    witness sessions are available on request.
                  </p>
                </div>

                <ol className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
                  {QUALITY_STEPS.map((q) => (
                    <li key={q.step} className="flex items-start gap-5 py-4">
                      <span className="font-mono pt-0.5 text-sm font-semibold tabular-nums text-sky-700">
                        {q.step}
                      </span>
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900">
                          {q.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{q.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col justify-between gap-6 lg:col-span-6">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900 lg:aspect-auto lg:flex-1">
                  <ResilientImage
                    src={facilityCmmImg}
                    alt="Climate-controlled metrology laboratory with bridge Coordinate Measuring Machine probing an aerospace aluminum manifold"
                    fallbackTitle="ISO 9001:2015 CMM Metrology Lab"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div>
                    <div className="text-xs text-slate-500">Bridge CMM Accuracy</div>
                    <div className="font-mono mt-1 text-base font-semibold tabular-nums text-slate-900">
                      ±1.8 µm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Certification</div>
                    <div className="font-mono mt-1 text-base font-semibold tabular-nums text-slate-900">
                      ISO 9001:2015
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Inspection Docs</div>
                    <div className="font-mono mt-1 text-base font-semibold text-slate-900">
                      FAI / CoC / 3.1
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: INSTANT RFQ & CONTACT */}
        <section
          id="contact"
          className="scroll-mt-20 border-t border-slate-200 bg-slate-900 py-20 text-white lg:py-24"
        >
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="text-xs font-semibold tracking-wider text-sky-400 uppercase">
                  Request for Quotation
                </p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Send Your Drawing for a 24-Hour DFM &amp; Cost Quote
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Share your process requirements, material grade, and batch quantity. Our
                  manufacturing engineers review every RFQ for manufacturability before quoting.
                </p>

                <dl className="mt-8 space-y-5 border-t border-white/15 pt-8 text-sm">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
                    <div>
                      <dt className="text-slate-400">Engineering &amp; RFQ Desk</dt>
                      <dd className="mt-0.5 font-medium text-white">
                        <a
                          href="mailto:rfq@apexforge-cnc.com"
                          className="underline-offset-4 hover:underline"
                        >
                          rfq@apexforge-cnc.com
                        </a>
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MessageSquare
                      className="mt-0.5 h-5 w-5 shrink-0 text-sky-400"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-slate-400">WhatsApp Direct Engineering</dt>
                      <dd className="font-mono mt-0.5 font-medium tabular-nums text-white">
                        +86 155 1187 6112
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileCheck2
                      className="mt-0.5 h-5 w-5 shrink-0 text-sky-400"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-slate-400">Supported CAD &amp; NDA Protection</dt>
                      <dd className="mt-0.5 text-slate-200">
                        STEP (.stp), IGES (.igs), Parasolid (.x_t), DXF, PDF · Mutual NDA signed
                        before file transfer
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
                    <div>
                      <dt className="text-slate-400">Export Incoterms &amp; Logistics</dt>
                      <dd className="mt-0.5 text-slate-200">
                        EXW, FOB, CIF, DDP Air Express (DHL / FedEx / UPS)
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl bg-white p-7 text-slate-900 shadow-lg sm:p-8 lg:col-span-7">
                {inlineSubmittedId ? (
                  <div className="py-8" role="status">
                    <div className="flex items-center gap-2.5 text-emerald-700">
                      <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      <span className="text-sm font-semibold tracking-wide uppercase">
                        RFQ Submitted
                      </span>
                    </div>
                    <h3 className="font-display mt-3 text-2xl font-bold text-slate-900">
                      Thank you — Reference{' '}
                      <span className="font-mono tabular-nums text-sky-700">
                        {inlineSubmittedId}
                      </span>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      We have logged your specifications for{' '}
                      <strong className="text-slate-900">{inlineForm.process}</strong> (
                      {inlineForm.material}). A manufacturing engineer will email your formal quote
                      and DFM feedback to{' '}
                      <strong className="text-slate-900">{inlineForm.email}</strong> within 24
                      hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSubmittedId(null);
                        setInlineForm(INITIAL_FORM);
                      }}
                      className="mt-6 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInlineSubmit} noValidate className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Instant Project Quote Form
                      </h3>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <ShieldCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
                        NDA Protected
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="rfq-name"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Full Name *
                        </label>
                        <input
                          id="rfq-name"
                          type="text"
                          required
                          value={inlineForm.name}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, name: e.target.value })
                          }
                          placeholder="e.g. Michael Carter"
                          className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="rfq-email"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Business Email *
                        </label>
                        <input
                          id="rfq-email"
                          type="email"
                          required
                          value={inlineForm.email}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, email: e.target.value })
                          }
                          placeholder="name@company.com"
                          className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="rfq-company"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Company Name *
                        </label>
                        <input
                          id="rfq-company"
                          type="text"
                          required
                          value={inlineForm.company}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, company: e.target.value })
                          }
                          placeholder="Company & Country"
                          className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="rfq-process"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Primary Process
                        </label>
                        <select
                          id="rfq-process"
                          value={inlineForm.process}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, process: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        >
                          <option>5-Axis Milling</option>
                          <option>CNC Turning</option>
                          <option>Sheet Metal Fabrication</option>
                          <option>Surface Finishing</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="rfq-material"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Material Grade
                        </label>
                        <select
                          id="rfq-material"
                          value={inlineForm.material}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, material: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        >
                          <option>Aluminum 6061-T6 / 7075-T6</option>
                          <option>Stainless Steel 304 / 316L / 17-4PH</option>
                          <option>Titanium Ti-6Al-4V (Grade 5)</option>
                          <option>Brass C360 / Copper C110</option>
                          <option>Engineering Plastic (PEEK / Delrin)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="rfq-tolerance"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Target Tolerance
                        </label>
                        <select
                          id="rfq-tolerance"
                          value={inlineForm.tolerance}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, tolerance: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        >
                          <option>±0.005 mm (Precision)</option>
                          <option>±0.010 mm (Tight)</option>
                          <option>±0.025 mm (ISO 2768-f)</option>
                          <option>±0.050 mm (Standard)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="rfq-qty"
                          className="mb-1.5 block text-xs font-semibold text-slate-700"
                        >
                          Batch Quantity
                        </label>
                        <select
                          id="rfq-qty"
                          value={inlineForm.quantity}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, quantity: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                        >
                          <option>1 – 9 pcs (Prototype)</option>
                          <option>10 – 50 pcs (Prototype / Pilot)</option>
                          <option>50 – 500 pcs (Low Volume)</option>
                          <option>500+ pcs (Production)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="rfq-notes"
                        className="mb-1.5 block text-xs font-semibold text-slate-700"
                      >
                        Specifications, Surface Finish &amp; CAD File Link (Optional)
                      </label>
                      <textarea
                        id="rfq-notes"
                        rows={3}
                        value={inlineForm.notes}
                        onChange={(e) =>
                          setInlineForm({ ...inlineForm, notes: e.target.value })
                        }
                        placeholder="Include part dimensions, surface finish (e.g. Type III Anodize), delivery port, or link to STEP/PDF files."
                        className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    {inlineError && (
                      <div
                        role="alert"
                        className="rounded-md bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
                      >
                        {inlineError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-md bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                    >
                      Submit RFQ for 24-Hour Quote
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-200 bg-slate-950 py-10 text-sm text-slate-400">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-6 px-6 sm:flex-row sm:items-center">
          <div>
            <span className="font-display font-bold text-white">ApexForge Precision</span>
            <span className="mx-2 text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>ISO 9001:2015 Custom CNC Machining &amp; Rapid Prototyping</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="#capabilities" className="hover:text-white">
              Capabilities
            </a>
            <a href="#products" className="hover:text-white">
              Products
            </a>
            <a href="#quality" className="hover:text-white">
              Quality
            </a>
            <a href="mailto:rfq@apexforge-cnc.com" className="hover:text-white">
              rfq@apexforge-cnc.com
            </a>
            <span>© {new Date().getFullYear()} ApexForge Precision</span>
          </div>
        </div>
      </footer>

      {/* INTERACTIVE RFQ MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rfq-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 id="modal-rfq-title" className="font-display text-xl font-bold text-slate-900">
                  Request a Custom CNC Quote
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Engineering DFM &amp; pricing reply within 1 business day.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close quote modal"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalSubmittedId ? (
              <div className="py-6" role="status">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-semibold tracking-wider uppercase">
                    Request Received
                  </span>
                </div>
                <p className="font-display mt-3 text-lg font-bold text-slate-900">
                  Reference{' '}
                  <span className="font-mono tabular-nums text-sky-700">{modalSubmittedId}</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  We have queued your quote request for{' '}
                  <strong className="text-slate-900">{modalForm.process}</strong> (
                  {modalForm.material}). Confirmation has been prepared for{' '}
                  <strong className="text-slate-900">{modalForm.email}</strong>.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleModalSubmit} noValidate className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="m-name"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Full Name *
                    </label>
                    <input
                      id="m-name"
                      type="text"
                      required
                      value={modalForm.name}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="m-email"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Business Email *
                    </label>
                    <input
                      id="m-email"
                      type="email"
                      required
                      value={modalForm.email}
                      onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="m-company"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Company *
                    </label>
                    <input
                      id="m-company"
                      type="text"
                      required
                      value={modalForm.company}
                      onChange={(e) => setModalForm({ ...modalForm, company: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="m-process"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Process
                    </label>
                    <input
                      id="m-process"
                      type="text"
                      value={modalForm.process}
                      onChange={(e) => setModalForm({ ...modalForm, process: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="m-material"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Material
                    </label>
                    <input
                      id="m-material"
                      type="text"
                      value={modalForm.material}
                      onChange={(e) => setModalForm({ ...modalForm, material: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="m-tolerance"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Tolerance
                    </label>
                    <input
                      id="m-tolerance"
                      type="text"
                      value={modalForm.tolerance}
                      onChange={(e) => setModalForm({ ...modalForm, tolerance: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="m-notes"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Part Notes / Quantity / Finish
                  </label>
                  <textarea
                    id="m-notes"
                    rows={3}
                    value={modalForm.notes}
                    onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                    placeholder="Quantity, target lead time, surface finish, or CAD drawing link"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>

                {modalError && (
                  <div
                    role="alert"
                    className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    {modalError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Send Quote Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
