'use strict';

window.DO_ROLE_DATA = (() => {

  const BASE_LENSES = ['CoDe', 'BIM', 'VDC', 'FAB', 'DLT'];

  /* ───────────────────────────────────────────────
     Lens content — drawn directly from the
     StructureCraft role-responsibility PDFs
     ─────────────────────────────────────────────── */

  const LENS_CONTENT = {
    BIM: {
      summary:
        'Creates Revit-based models, layout drawings, and coordinated drawing sets aligned with StructureCraft standards, engineering markups, and design-for-fabrication principles.',
      bullets: [
        'Create plans, sections, details, and 3D model content from concept sketches and engineering designs in Revit.',
        'Apply markups from engineers and leads with a design-for-fabrication mindset — we build everything we design.',
        'Coordinate with ENG, PM, and BIM team to maintain accurate, coherent models and drawing sets on schedule.',
        'Manage document control and official submission of Drawing Sets to ENG/DO Fab Lead.',
        'Import Branch models for Layout/Erection Set creation and coordinate with DO Fabrication Team.',
        'Support Trimble Connect uploads and clash detection workflows for project handover.',
        'Onboard and train teammates on BIM drafting standards, processes, and workflows.'
      ]
    },

    FAB: {
      summary:
        'Delivers Branch-based fabrication modeling and connection detailing producing production-ready LOD350\u2013450 models, fabrication drawings, and CNC-optimized outputs.',
      bullets: [
        'Model connections from ENG design sketches in Branch with respect to external Arch, Struct, and MEP sets.',
        'Produce LOD350\u2013450 fabrication models and drawings (DLT, GLM, STL) with traceable quality checks.',
        'Export Branch models for Layout/Erection Set creation in Revit and coordinate with BIM Team.',
        'Manage IFA, IFC, IFF submissions to PM and upload fabrication packages on Procore.',
        'Work with CNC programmer to ensure modeled parts are ready and optimized for fabrication.',
        'Handle RFIs \u2014 draft, review incoming responses, and coordinate action items with ENG/PM.',
        'Contribute to Branch standards, release testing, and department workflow improvements.'
      ]
    },

    DLT: {
      summary:
        'Provides specialist DLT fabrication modeling, drawing production, and CNC-ready detailing through Branch/Revit interfaces with deep dowel-laminated timber product knowledge.',
      bullets: [
        'Develop LOD300\u2013450 DLT fabrication models and DLT/GLM/STL drawing packages from ENG design sketches.',
        'Model DLT connections with respect to external Arch, Struct, and MEP sets and engineering constraints.',
        'Manage IFA, IFC, IFF submissions to PM and upload DLT fabrication packages on Procore.',
        'Collaborate with shop to ensure modeled DLT aligns with best fabrication practices and CNC files communicate clearly.',
        'Ensure Trimble Connect uploads and VDC coordination compliance on DLT scope.',
        'Work with Branch team to develop DLT-focused tools that reduce modeling times across project phases.',
        'Serve as DLT subject matter expert for the Drawing Office and mentor others on DLT best practices.'
      ]
    },

    VDC: {
      summary:
        'Leads project coordination systems, shared coordinate alignment, clash-free model workflows, and external model exchange cadence during construction-phase delivery.',
      bullets: [
        'Lead coordination systems and processes on all projects during construction phase.',
        'Set the zero project for fabrication models based on models by others.',
        'Align Project Internal, Project Base Point, and Shared Coordinate systems with external design teams.',
        'Facilitate and monitor creation of coordinated, clash-free models across all software platforms.',
        'Manage external weekly model uploads and BIM meeting interfaces during construction phase.',
        'Set up VDC Kickoff meetings with DO Fab Team and develop project-specific VDC Systems.',
        'Manage VDC software integration roadmap and coordinate with IT on licensing and deployment.'
      ]
    },

    CoDe: {
      summary:
        'Develops computational tooling and automation that reduces modeling effort, improves consistency, and accelerates cross-lens delivery across BIM, FAB, DLT, and VDC workflows.',
      bullets: [
        'Translate repetitive BIM/FAB/DLT/VDC workflows into reusable automation tools and scripts.',
        'Build parametric logic and data-consistent output generation across project phases.',
        'Embed automated checks and repeatable workflows to improve release reliability.',
        'Coordinate tooling needs with IT and software strategy for scalable deployment.',
        'Input into Branch features and support integration of computational methods into project workflows.',
        'Enable faster modeling cycles by reducing manual rework across technical teams.',
        'Plan long-term software solutions and work with IT on licenses, hardware, and deployment strategy.'
      ]
    }
  };

  /* ───────────────────────────────────────────────
     Phase qualification rules
     ─────────────────────────────────────────────── */

  const PHASE_RULES = [
    { id: 'BD',       label: 'Business Development', requiredLens: 'CoDe', additionalLenses: ['BIM', 'FAB'] },
    { id: 'EOR',      label: 'EOR Consulting',       requiredLens: 'BIM',  additionalLenses: ['CoDe', 'FAB', 'DLT'] },
    { id: 'Delivery', label: 'Delivery',             requiredLens: 'FAB',  additionalLenses: ['CoDe', 'DLT', 'BIM', 'VDC'] }
  ];

  const PHASE_CONTENT = {
    BD: {
      summary:
        'Combines lens capabilities to support business development \u2014 scope definition, fee input, client engagement, and early project set-up before design handoff.',
      bullets: [
        'Provide technical input during scope definition and fee estimation for incoming project opportunities.',
        'Support client presentations and proposal development with lens-specific delivery expertise.',
        'Own day-to-day BD-phase integration: sequence early-stage work, coordinate handoffs, and escalate blockers.'
      ]
    },
    EOR: {
      summary:
        'Combines lens capabilities to support EOR consulting \u2014 coordinating design intent, model development, and drawing production through the consulting phase.',
      bullets: [
        'Coordinate design intent from ENG sketches into models and drawing sets during consulting phase.',
        'Manage consulting-phase scheduling with PM/ENG and track progress against internal and external deadlines.',
        'Own day-to-day EOR-phase integration: sequence work, coordinate handoffs, and escalate blockers.'
      ]
    },
    Delivery: {
      summary:
        'Combines lens capabilities to support fabrication delivery \u2014 production modeling, shop drawing management, Procore uploads, and CNC coordination through the fabrication phase.',
      bullets: [
        'Drive fabrication-phase model and drawing production to meet shop and site delivery schedules.',
        'Coordinate between fab modeling, BIM, and VDC teams to maintain integrated, clash-free outputs.',
        'Own day-to-day Delivery-phase integration: sequence work, coordinate handoffs, and escalate blockers.'
      ]
    }
  };

  /* ───────────────────────────────────────────────
     Senior-level phase bridges
     ─────────────────────────────────────────────── */

  const PHASE_BRIDGES = [
    { id: 'BD_EOR',       from: 'BD',  to: 'EOR',      label: 'BD \u2192 EOR' },
    { id: 'EOR_DELIVERY', from: 'EOR', to: 'Delivery', label: 'EOR \u2192 Delivery' },
    { id: 'BD_DELIVERY',  from: 'BD',  to: 'Delivery', label: 'BD \u2192 Delivery' }
  ];

  const BRIDGE_LENS_RULES = {
    BD_EOR:       { requiredLenses: ['BIM', 'CoDe'], requiredOneOf: [] },
    EOR_DELIVERY: { requiredLenses: ['BIM'],          requiredOneOf: ['FAB', 'DLT'] },
    BD_DELIVERY:  { requiredLenses: ['CoDe'],         requiredOneOf: ['FAB', 'DLT'] }
  };

  const BRIDGE_CONTENT = {
    BD_EOR: {
      summary:
        'Bridges BD into EOR consulting, maintaining scope intent and client commitments through the transition into active design coordination.',
      bullets: [
        'Maintain continuity of project scope and client expectations from BD through consulting-phase execution.',
        'Oversee cross-phase quality, resolving tradeoffs and sequencing dependencies between BD and EOR.'
      ]
    },
    EOR_DELIVERY: {
      summary:
        'Bridges EOR consulting into fabrication delivery, ensuring design models translate accurately into production-ready outputs and shop-floor coordination.',
      bullets: [
        'Transfer consulting-phase project setup, model standards, and coordination context into fabrication execution.',
        'Oversee cross-phase quality, resolving tradeoffs and sequencing dependencies between EOR and Delivery.'
      ]
    },
    BD_DELIVERY: {
      summary:
        'Bridges BD directly into fabrication delivery, connecting early-stage scope decisions with production outcomes and shop coordination.',
      bullets: [
        'Connect BD-phase scope decisions with fabrication delivery outcomes and production sequencing.',
        'Oversee cross-phase quality, resolving tradeoffs and sequencing dependencies between BD and Delivery.'
      ]
    }
  };

  /* ───────────────────────────────────────────────
     Leadership definitions
     ─────────────────────────────────────────────── */

  const MANAGER_DEFS = [
    {
      id: 'delivery', title: 'Delivery Process Manager',
      managerLens: 'Delivery', displayLenses: ['FAB', 'DLT', 'VDC', 'CoDe'],
      summary: 'Owns fabrication delivery standards, capability growth, staffing, and quality consistency across the DO Fab team.',
      bullets: [
        'Manage 3D Design Leads and projects; create project schedules and WEs.',
        'Support in managing fabrication resources between projects and ensure priority of deliverables.',
        'Set and maintain fabrication model and drawing standards with continual department improvement.',
        'Responsible for reviewing and approving outsource 3D design scope and fees.',
        'Training and mentorship of 3D Design Leads; onboarding new team members.',
        'Long-term planning on software solutions; work with IT to manage licenses and hardware.',
        'Collect feedback on Branch releases and incorporate Revit into project workflows.'
      ]
    },
    {
      id: 'bim', title: 'BIM Process Manager',
      managerLens: 'BIM', displayLenses: ['BIM', 'CoDe'],
      summary: 'Owns BIM consulting standards, capability growth, staffing, and quality consistency across the BIM team.',
      bullets: [
        'Manage BIM Leads and projects; create consulting project schedules and WEs.',
        'Support in managing BIM resources between projects and ensure priority of deliverables.',
        'Set and maintain model and drafting standards with continual department improvement.',
        'Training and mentorship of BIM Leads; onboarding new team members.',
        'Long-term planning on software solutions; work with IT to manage licenses and hardware.',
        'Collect feedback on releases and incorporate Branch into project workflows.',
        'Responsible for resolving issues with team members and ensuring best practices are adhered to.'
      ]
    },
    {
      id: 'dlt', title: 'DLT Process Manager',
      managerLens: 'DLT', displayLenses: ['DLT', 'CoDe'],
      summary: 'Owns DLT fabrication standards, capability growth, staffing, and quality consistency across the DLT team.',
      bullets: [
        'Manage DLT Technician Leads and projects; create project schedules and WEs for DLT scope.',
        'Support in managing DLT resources between projects and ensure priority of DLT deliverables.',
        'Set and maintain DLT-specific modeling and drawing standards with continual improvement.',
        'Collaborate with shop to ensure DLT aligns with best fabrication practices and CNC clarity.',
        'Work with Branch team to develop DLT-focused tools that reduce modeling times.',
        'Training and mentorship of DLT team; onboarding new team members.',
        'Long-term planning on DLT software solutions and coordination with IT.'
      ]
    },
    {
      id: 'code', title: 'CoDe Process Manager',
      managerLens: 'CoDe', displayLenses: ['CoDe', 'BIM', 'FAB'],
      summary: 'Owns computational design standards, tooling strategy, and automation deployment across all technical teams.',
      bullets: [
        'Lead computational tooling strategy and coordinate deployment across BIM, FAB, DLT, and VDC workflows.',
        'Manage Computational Designer Leads and projects; plan long-term software solutions.',
        'Coordinate tooling needs with IT and software strategy for scalable, maintainable deployment.',
        'Embed automated checks, scripting, and repeatable workflows to improve release reliability.',
        'Input into Branch features and support integration of computational methods into project workflows.',
        'Enable faster modeling cycles by reducing manual rework across all technical teams.',
        'Training and mentorship of computational designers; onboarding new team members.'
      ]
    }
  ];

  const PROJECT_LEAD_DEF = {
    title: 'Project Lead',
    summary:
      'Owns integrated project outcomes across all phases (BD, EOR, Delivery) and all lenses, with mandatory CoDe capability driving computational efficiency in decision-making.',
    bullets: [
      'Lead project execution through multi-lens decision-making with mandatory CoDe capability.',
      'Operate across all major phases: BD scope, EOR consulting, and Delivery fabrication.',
      'Own final project outcomes, strategy, and integrated delivery performance.',
      'Collaborate and problem-solve with clients and stakeholders while working with PM to keep projects on course.',
      'Create and manage project schedules and WEs across consulting and fabrication phases.',
      'Responsible for transferring all key project info during phase handovers.',
      'Lead by example \u2014 take the time to do it right the first time.'
    ]
  };

  /* ───────────────────────────────────────────────
     Level definitions
     ─────────────────────────────────────────────── */

  const LEVELS = [
    { key: 'base',         title: 'Lens-Specific Roles (1 Lens)' },
    { key: 'intermediate', title: 'Intermediate Roles (Phase Integrators)' },
    { key: 'senior',       title: 'Senior Roles (Phase Crossovers)' },
    { key: 'leadership',   title: 'Leadership (Project Leads + Process Managers)' }
  ];

  return {
    BASE_LENSES,
    LENS_CONTENT,
    PHASE_RULES,
    PHASE_CONTENT,
    PHASE_BRIDGES,
    BRIDGE_LENS_RULES,
    BRIDGE_CONTENT,
    MANAGER_DEFS,
    PROJECT_LEAD_DEF,
    LEVELS
  };
})();
