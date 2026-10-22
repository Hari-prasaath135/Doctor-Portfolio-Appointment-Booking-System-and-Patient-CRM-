export const doctorInfo = {
  id: "dr-vijay-main",
  name: "Dr. Vijay",
  fullTitle: "Dr. Vijay ",
  specialization: "Interventional Radiologist",
  tagline: "Minimally Invasive, Maximally Effective",
  shortBio:
    "A highly accomplished Interventional Radiologist with 10+ years of medical experience, currently serving as Deputy Medical Superintendent and Consultant & Assistant Professor at Aarupadai Veedu Medical College & Hospital, Pondicherry.",
  fullBio: `Dr. Vijay Sooriyakumar is a highly accomplished Interventional Radiologist with over 10 years of medical experience, currently serving as Deputy Medical Superintendent and Consultant & Assistant Professor at Aarupadai Veedu Medical College & Hospital, Pondicherry.

He is the second doctor in Karnataka to graduate with a DM in Interventional Radiology and a recipient of multiple academic Gold Medals, including the DM Interventional Radiology and MD Radiodiagnosis Gold Medals.

His professional expertise spans Interventional Radiology, Diagnostic Imaging, Image Interpretation, and 3D Medical Image Segmentation, complemented by extensive academic teaching experience.`,
  qualifications: [
    "MBBS",
    "MD (Radiodiagnosis)",
    "DM (Interventional Radiology)",
  ],
  experience: "10+",
  proceduresCount: "5000+",
  patientsCount: "4500+",
  specializedTreatments: "50+",
  expertise: [
    "Vascular Interventions",
    "Non-Vascular Interventions",
    "Image-Guided Procedures",
    "Pain Management",
    "Oncology Interventions",
    "Embolization Procedures",
  ],
} as const

export const availableTimeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const

export const awards = [
  {
    id: "dr-mulimani-gold-medal",
    title: "Dr. Mulimani Gold Medal",
    issuer: "Jawaharlal Nehru Medical College",
    description:
      "Awarded for obtaining the 1st rank in DM Interventional Radiology examinations in the college, with a score of 75% in DM clinical and viva exam.",
  },
  {
    id: "second-dm-karnataka",
    title: "2nd DM Interventional Radiology Graduate in Karnataka",
    issuer: "State of Karnataka",
    description:
      "The second candidate to graduate with a DM degree in Interventional Radiology from the state of Karnataka.",
  },
  {
    id: "dr-srinivasan-gold-medal",
    title: "Dr. K.G. Srinivasan Gold Medal",
    issuer: "Madurai Medical College",
    description:
      "Awarded for having obtained 1st rank in the MD (Radiodiagnosis) postgraduate examination, with a score of 78% in MD clinical and viva exam.",
  },
] as const

export const expertiseCategories = [
  {
    id: "neuro-interventions",
    title: "Neuro-Interventions",
    items: [
      "Cerebral digital subtraction angiography",
      "Stroke — Mechanical thrombectomy (Stentriever, ADAPT, SOLUMBRA), intra-arterial thrombolysis, tandem occlusion treatment",
      "Intracranial aneurysm — Endovascular embolization (coiling, flow diverter, parent artery occlusion)",
      "Intracranial & extracranial atherosclerotic disease — Angioplasty and stenting",
      "CNS AVM and AVF — Endovascular embolization",
      "Cerebral venous thrombosis — Mechanical thrombectomy and thrombolysis",
    ],
  },
  {
    id: "peripheral-vascular",
    title: "Peripheral Vascular Interventions",
    items: [
      "Peripheral arterial disease — Angioplasty and stenting",
      "Deep venous thrombosis — Mechanical thrombectomy, catheter-directed thrombolysis, IVC filter deployment",
      "Varicose veins — Endovenous ablation, adhesive embolization, sclerotherapy",
      "Peripheral AVMs and vascular malformations — Endovascular embolization / sclerotherapy",
    ],
  },
  {
    id: "aortic-interventions",
    title: "Aortic Interventions",
    items: [
      "Aortic aneurysm, dissection, intramural hematoma — TEVAR, EVAR",
    ],
  },
  {
    id: "vascular-bleeders",
    title: "Vascular Bleeders",
    items: [
      "Secondary/traumatic/iatrogenic bleeding — Endovascular/percutaneous embolization",
    ],
  },
  {
    id: "vascular-access",
    title: "Vascular Access Interventions",
    items: [
      "Tunnelled and non-tunnelled haemodialysis access catheter placement",
      "Peripherally inserted central catheters (PICC) placement",
      "Central line placement",
    ],
  },
  {
    id: "thoracic-interventions",
    title: "Thoracic Interventions",
    items: [
      "Pulmonary thromboembolism — Mechanical thrombectomy and thrombolysis",
      "Pulmonary AVMs — Endovascular embolization",
      "Hemoptysis — Bronchial artery embolization",
    ],
  },
  {
    id: "hepatobiliary-interventions",
    title: "Hepatobiliary Interventions",
    items: [
      "Obstructive jaundice — Percutaneous transhepatic biliary drainage & stenting",
      "Portal hypertension — TIPS, gastric variceal embolization, splenic artery embolization",
    ],
  },
  {
    id: "renal-genitourinary",
    title: "Renal & Genitourinary Interventions",
    items: [
      "Hydronephrosis — Percutaneous nephrostomy, antegrade ureteric stenting",
      "Benign prostatic hypertrophy — Prostatic artery embolization",
    ],
  },
  {
    id: "gastrointestinal-interventions",
    title: "Gastrointestinal Interventions",
    items: [
      "Naso-jejunostomy tube placement",
      "Percutaneous gastrostomy",
      "Celiac artery and SMA atherosclerotic disease — Angioplasty and stenting",
      "Acute mesenteric ischemia — Endovascular recanalization by mechanical thrombectomy",
      "Abdominal vasculature pseudoaneurysms — Endovascular embolization",
    ],
  },
  {
    id: "onco-interventions",
    title: "Onco-Interventions",
    items: [
      "Trans-arterial chemo-embolization",
      "Trans-arterial radioembolization",
      "Tumour ablations — Laser, microwave, radiofrequency, cryoablation, irreversible electroporation",
      "Pre-operative tumour embolization",
      "Chemo-port placement",
    ],
  },
  {
    id: "musculoskeletal-interventions",
    title: "Musculoskeletal Interventions",
    items: [
      "Osteoarthritis — Genicular artery embolization",
      "Frozen shoulder — Shoulder arteries embolization",
      "Vertebral augmentation — Vertebroplasty, kyphoplasty",
      "Inter-vertebral disc disease — Disc ablation",
    ],
  },
  {
    id: "pain-interventions",
    title: "Pain Interventions",
    items: [
      "Joint injections",
      "Epidural injections for back aches and disc disease",
      "Ganglion and nerve blocks (celiac, pudendal, trigeminal, etc.)",
    ],
  },
  {
    id: "pelvic-interventions",
    title: "Pelvic Interventions",
    items: [
      "Uterine fibroids, adenomyosis, postpartum hemorrhage — Uterine artery embolization",
      "Infertility and impotence — Fallopian tube recanalization, varicocele embolization, penile artery recanalization/venous embolization",
    ],
  },
  {
    id: "fetal-interventions",
    title: "Fetal Interventions",
    items: [
      "Amniocentesis and amnioinfusion",
      "Chorionic villus sampling",
      "Selective fetal reduction — for anomalies and higher-order pregnancies",
    ],
  },
  {
    id: "non-vascular-interventions",
    title: "Non-Vascular Interventions",
    items: ["Image-guided FNACs, biopsies, drainages"],
  },
  {
    id: "diagnostic-radiology",
    title: "Diagnostic Radiology",
    items: [
      "USG, Doppler",
      "CT & CT angiography",
      "MRI",
      "X-ray, mammography, fluoroscopy",
    ],
  },
] as const

export const lifeSupportCertifications = [
  "Basic Life Support (BLS) Provider",
  "Advanced Cardiovascular Life Support (ACLS) Provider",
] as const
export const achievements = [
  {
    number: 10,
    suffix: "+",
    label: "Years of Experience",
  },
  {
    number: 5000,
    suffix: "+",
    label: "Procedures Performed",
  },
  {
    number: 4500,
    suffix: "+",
    label: "Patients Treated",
  },
  {
    number: 50,
    suffix: "+",
    label: "Specialized Treatments",
  },
] as const
export const whyChoose = [
  {
    icon: "GraduationCap",
    title: "Highly Qualified",
    description:
      "MBBS, MD, and DM in Interventional Radiology with multiple academic gold medals.",
  },
  {
    icon: "Minimize2",
    title: "Minimally Invasive",
    description:
      "Advanced image-guided techniques that reduce pain, scarring, and recovery time.",
  },
  {
    icon: "Monitor",
    title: "Advanced Technology",
    description:
      "State-of-the-art imaging and equipment for precise, effective procedures.",
  },
  {
    icon: "HeartHandshake",
    title: "Patient-Centered Care",
    description:
      "Compassionate, personalized treatment plans tailored to each patient's needs.",
  },
] as const

export const services = [
  {
    id: "vascular-interventions",
    icon: "Heart",
    category: "Vascular",
    name: "Vascular Interventions",
    shortDescription:
      "Minimally invasive treatments for blood vessel conditions, including angioplasty and embolization.",
  },
  {
    id: "non-vascular-interventions",
    icon: "Activity",
    category: "Non-Vascular",
    name: "Non-Vascular Interventions",
    shortDescription:
      "Image-guided biopsies, drainages, and FNACs performed with precision and minimal discomfort.",
  },
  {
    id: "onco-interventions",
    icon: "Target",
    category: "Oncology",
    name: "Onco-Interventions",
    shortDescription:
      "Targeted tumor ablation and embolization procedures for cancer treatment and palliation.",
  },
  {
    id: "diagnostic-imaging",
    icon: "Stethoscope",
    category: "Diagnostics",
    name: "Diagnostic Imaging",
    shortDescription:
      "Comprehensive imaging services including USG, CT, MRI, and fluoroscopy for accurate diagnosis.",
  },
  {
    id: "pain-management",
    icon: "Shield",
    category: "Pain Care",
    name: "Pain Management",
    shortDescription:
      "Nerve blocks, joint and epidural injections for effective, long-lasting pain relief.",
  },
  {
    id: "image-guided-procedures",
    icon: "Search",
    category: "Procedures",
    name: "Image-Guided Procedures",
    shortDescription:
      "Precision-guided interventions using real-time imaging for safer, more accurate outcomes.",
  },
  {
    id: "embolization-procedures",
    icon: "Droplets",
    category: "Embolization",
    name: "Embolization Procedures",
    shortDescription:
      "Advanced techniques to block abnormal blood flow in tumors, fibroids, and vascular malformations.",
  },
  {
    id: "vascular-access",
    icon: "Zap",
    category: "Access",
    name: "Vascular Access",
    shortDescription:
      "Safe placement of dialysis catheters, PICC lines, and central lines for ongoing treatment.",
  },
] as const

export const testimonials = [
  {
    id: "testimonial-1",
    name: "Rajesh Kumar",
    treatment: "Uterine Fibroid Embolization",
    rating: 5,
    review:
      "Dr. Vijay's care made a world of difference. The procedure was minimally invasive and my recovery was much faster than I expected.",
  },
  {
    id: "testimonial-2",
    name: "Priya Sundaram",
    treatment: "Varicose Vein Treatment",
    rating: 5,
    review:
      "Professional, attentive, and clearly explains every step. I felt fully informed and comfortable throughout my treatment.",
  },
  {
    id: "testimonial-3",
    name: "Anand Raj",
    treatment: "Pain Management",
    rating: 4,
    review:
      "Excellent results with the nerve block procedure. The pain relief has significantly improved my quality of life.",
  },
] as const
export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/procedures", label: "Procedures" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/contact", label: "Contact" },
] as const

export const clinicInfo = {
  name: "Dr. Vijay Sooriyakumar Clinic",
  phone: "+91 98765 43210",
  email: "preethivijay2327@gmail.com",
  address: "RQJH+CWM Commune Panchayat, Pondy Cuddalore Main road Kirumampakkam Bahour, Kirumampakkam, Puducherry ",
  city: "Pondicherry",
  state: "Puducherry",
  pincode: "607403",
  workingHours: {
    weekdays: "9:00 AM – 6:00 PM",
    saturday: "9:00 AM – 2:00 PM",
    sunday: "Closed",
  },
} as const
export const procedures = [
  {
    id: "uterine-fibroid-embolization",
    name: "Uterine Fibroid Embolization",
    description:
      "A minimally invasive procedure that blocks blood flow to uterine fibroids, causing them to shrink without the need for surgery.",
    benefits: [
      "No major surgical incision required",
      "Shorter recovery time compared to hysterectomy",
      "Preserves the uterus",
      "Performed under local anesthesia",
    ],
    whoNeedsIt:
      "Women experiencing heavy menstrual bleeding, pelvic pain, or pressure symptoms caused by uterine fibroids.",
  },
  {
    id: "prostatic-artery-embolization",
    name: "Prostatic Artery Embolization",
    description:
      "A targeted procedure that reduces blood supply to an enlarged prostate, relieving urinary symptoms caused by benign prostatic hyperplasia.",
    benefits: [
      "Avoids traditional prostate surgery",
      "Preserves sexual function",
      "Minimal downtime and quick recovery",
      "Effective symptom relief within weeks",
    ],
    whoNeedsIt:
      "Men with an enlarged prostate experiencing frequent urination, weak urine flow, or incomplete bladder emptying.",
  },
  {
    id: "mechanical-thrombectomy",
    name: "Mechanical Thrombectomy",
    description:
      "An advanced, image-guided technique to physically remove blood clots from vessels, restoring normal blood flow quickly and safely.",
    benefits: [
      "Rapid restoration of blood flow",
      "Reduces risk of long-term tissue damage",
      "Minimally invasive with small incision",
      "Often performed as an emergency procedure",
    ],
    whoNeedsIt:
      "Patients with acute stroke, deep vein thrombosis, or pulmonary embolism requiring urgent clot removal.",
  },
] as const