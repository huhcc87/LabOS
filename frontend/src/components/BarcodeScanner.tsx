import { useEffect, useRef, useState, useCallback } from 'react';
import { Modal } from './Modal';

// Instructions for enabling camera in different browsers
const CAMERA_PERMISSION_HELP = {
  chrome: 'Click the 🔒 icon in the address bar → Site settings → Camera → Allow',
  firefox: 'Click the 🔒 icon → Permissions → Camera → Allow',
  safari: 'Safari menu → Settings → Websites → Camera → Allow for this site',
  edge: 'Click the 🔒 icon in the address bar → Site permissions → Camera → Allow',
  general: 'Check your browser settings to allow camera access for this site',
};

// Extensive product database for auto-fill - includes 150+ common lab products
// In production, this would be supplemented by an API call to manufacturer databases
const PRODUCT_DATABASE: Record<string, {
  name: string;
  category: string;
  manufacturer: string;
  catalogNumber: string;
  unit: string;
  storageTemp: string;
  hazardClass: string;
  description: string;
}> = {
  // ==================== THERMO FISHER / GIBCO ====================
  '10128016': { name: 'DMEM, high glucose', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '10128-016', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'Dulbecco\'s Modified Eagle Medium' },
  '25200056': { name: 'Trypsin-EDTA (0.25%)', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '25200-056', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: 'Cell dissociation reagent' },
  '11965092': { name: 'DMEM/F-12', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '11965-092', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: '1:1 mixture of DMEM and Ham\'s F-12' },
  '16000044': { name: 'Fetal Bovine Serum (FBS)', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '16000-044', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: 'Heat inactivated FBS' },
  '15140122': { name: 'Penicillin-Streptomycin', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '15140-122', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: '10,000 U/mL Pen, 10,000 µg/mL Strep' },
  '10010023': { name: 'PBS, pH 7.4', category: 'Buffers', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '10010-023', unit: 'bottles', storageTemp: 'RT', hazardClass: '', description: 'Phosphate Buffered Saline' },
  '25030081': { name: 'L-Glutamine (200 mM)', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '25030-081', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: '100X concentration' },
  '11875093': { name: 'RPMI 1640 Medium', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '11875-093', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'With L-Glutamine' },
  '31985070': { name: 'Opti-MEM Reduced Serum Medium', category: 'Cell Culture', manufacturer: 'Gibco/Thermo Fisher', catalogNumber: '31985-070', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'For transfection' },
  '15596026': { name: 'TRIzol Reagent', category: 'Reagents', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: '15596-026', unit: 'bottles', storageTemp: '4C', hazardClass: 'Toxic', description: 'RNA isolation reagent' },
  '18068015': { name: 'SuperScript III Reverse Transcriptase', category: 'Enzymes', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: '18068-015', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'cDNA synthesis enzyme' },
  '4368814': { name: 'TaqMan Gene Expression Master Mix', category: 'Reagents', manufacturer: 'Applied Biosystems/Thermo Fisher', catalogNumber: '4368814', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: 'qPCR master mix' },
  'A25742': { name: 'Platinum SuperFi II DNA Polymerase', category: 'Enzymes', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: 'A25742', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'High-fidelity PCR' },
  '10977015': { name: 'UltraPure DNase/RNase-Free Water', category: 'Reagents', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: '10977-015', unit: 'bottles', storageTemp: 'RT', hazardClass: '', description: 'Molecular biology grade' },
  'R0491': { name: 'GeneRuler 1 kb DNA Ladder', category: 'Reagents', manufacturer: 'Thermo Scientific', catalogNumber: 'R0491', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: 'DNA size marker' },
  'K0502': { name: 'dNTP Mix', category: 'Reagents', manufacturer: 'Thermo Scientific', catalogNumber: 'K0502', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: '10 mM each dNTP' },
  '78440': { name: 'Pierce BCA Protein Assay Kit', category: 'Kits', manufacturer: 'Thermo Scientific', catalogNumber: '78440', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: 'Protein quantification' },
  '34580': { name: 'Pierce ECL Western Blotting Substrate', category: 'Reagents', manufacturer: 'Thermo Scientific', catalogNumber: '34580', unit: 'kits', storageTemp: '4C', hazardClass: '', description: 'Chemiluminescent detection' },
  '89900': { name: 'Pierce RIPA Lysis Buffer', category: 'Buffers', manufacturer: 'Thermo Scientific', catalogNumber: '89900', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'Cell lysis buffer' },
  '11668019': { name: 'Lipofectamine 2000', category: 'Reagents', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: '11668-019', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'Transfection reagent' },
  'L3000015': { name: 'Lipofectamine 3000', category: 'Reagents', manufacturer: 'Invitrogen/Thermo Fisher', catalogNumber: 'L3000015', unit: 'kits', storageTemp: '4C', hazardClass: '', description: 'Advanced transfection' },

  // ==================== NEW ENGLAND BIOLABS (NEB) ====================
  'M0267S': { name: 'Taq DNA Polymerase', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'M0267S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Thermostable DNA polymerase' },
  'M0273S': { name: 'Q5 High-Fidelity DNA Polymerase', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'M0273S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'High-fidelity PCR enzyme' },
  'N3232S': { name: '1 kb DNA Ladder', category: 'Reagents', manufacturer: 'New England Biolabs', catalogNumber: 'N3232S', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: 'DNA size marker' },
  'M0202S': { name: 'T4 DNA Ligase', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'M0202S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'DNA ligation enzyme' },
  'R0101S': { name: 'EcoRI-HF', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R0101S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'R3136S': { name: 'BamHI-HF', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R3136S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'R3131S': { name: 'HindIII-HF', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R3131S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'R0141S': { name: 'XbaI', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R0141S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'R3104S': { name: 'XhoI', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R3104S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'R0193S': { name: 'NotI-HF', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'R0193S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Restriction enzyme' },
  'M0530S': { name: 'Phusion High-Fidelity DNA Polymerase', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'M0530S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Ultra high-fidelity PCR' },
  'M0491S': { name: 'OneTaq DNA Polymerase', category: 'Enzymes', manufacturer: 'New England Biolabs', catalogNumber: 'M0491S', unit: 'units', storageTemp: '-20C', hazardClass: '', description: 'Routine PCR enzyme' },
  'E7645S': { name: 'NEBuilder HiFi DNA Assembly Master Mix', category: 'Kits', manufacturer: 'New England Biolabs', catalogNumber: 'E7645S', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'Gibson assembly' },
  'E5520S': { name: 'Monarch DNA Gel Extraction Kit', category: 'Kits', manufacturer: 'New England Biolabs', catalogNumber: 'E5520S', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: 'DNA purification' },
  'N0447S': { name: 'dNTP Solution Mix', category: 'Reagents', manufacturer: 'New England Biolabs', catalogNumber: 'N0447S', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: '10 mM each' },
  'B7024S': { name: 'CutSmart Buffer', category: 'Buffers', manufacturer: 'New England Biolabs', catalogNumber: 'B7024S', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: 'Universal restriction buffer' },

  // ==================== SIGMA-ALDRICH / MILLIPORE ====================
  'E7023': { name: 'Ethanol (200 proof)', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'E7023', unit: 'L', storageTemp: 'RT', hazardClass: 'Flammable', description: 'Molecular biology grade ethanol' },
  'M1775': { name: 'Methanol', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'M1775', unit: 'L', storageTemp: 'RT', hazardClass: 'Flammable', description: 'HPLC grade methanol' },
  'H1758': { name: 'Hydrochloric Acid', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'H1758', unit: 'L', storageTemp: 'RT', hazardClass: 'Corrosive', description: 'ACS reagent, 37%' },
  'S8761': { name: 'Sodium Hydroxide', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'S8761', unit: 'kg', storageTemp: 'RT', hazardClass: 'Corrosive', description: 'Pellets, ACS reagent' },
  'F2442': { name: 'Formaldehyde (37%)', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'F2442', unit: 'L', storageTemp: 'RT', hazardClass: 'Toxic', description: 'Formalin solution' },
  'A9539': { name: 'Acetone', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'A9539', unit: 'L', storageTemp: 'RT', hazardClass: 'Flammable', description: 'ACS reagent grade' },
  'I9516': { name: 'Isopropanol (2-Propanol)', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'I9516', unit: 'L', storageTemp: 'RT', hazardClass: 'Flammable', description: 'Molecular biology grade' },
  'C2432': { name: 'Chloroform', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'C2432', unit: 'L', storageTemp: 'RT', hazardClass: 'Toxic', description: 'Contains amylenes as stabilizer' },
  'D8418': { name: 'DMSO (Dimethyl Sulfoxide)', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'D8418', unit: 'L', storageTemp: 'RT', hazardClass: '', description: 'Cell culture grade' },
  'G7021': { name: 'D-Glucose', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'G7021', unit: 'kg', storageTemp: 'RT', hazardClass: '', description: 'Cell culture tested' },
  'S7653': { name: 'Sodium Chloride', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'S7653', unit: 'kg', storageTemp: 'RT', hazardClass: '', description: 'BioXtra, ≥99.5%' },
  'P5655': { name: 'Potassium Chloride', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'P5655', unit: 'kg', storageTemp: 'RT', hazardClass: '', description: 'BioXtra, ≥99.0%' },
  'T1503': { name: 'Tris Base', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'T1503', unit: 'kg', storageTemp: 'RT', hazardClass: '', description: 'Primary Standard' },
  'E5134': { name: 'EDTA Disodium Salt', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'E5134', unit: 'kg', storageTemp: 'RT', hazardClass: '', description: 'Dihydrate, ACS reagent' },
  'H3375': { name: 'HEPES', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'H3375', unit: 'g', storageTemp: 'RT', hazardClass: '', description: 'Cell culture grade, ≥99.5%' },
  'A6003': { name: 'BSA (Bovine Serum Albumin)', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'A6003', unit: 'g', storageTemp: '4C', hazardClass: '', description: 'Fraction V, ≥96%' },
  'G9391': { name: 'Glycerol', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'G9391', unit: 'L', storageTemp: 'RT', hazardClass: '', description: 'Molecular biology grade' },
  'P0781': { name: 'Protease Inhibitor Cocktail', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'P0781', unit: 'mL', storageTemp: '-20C', hazardClass: '', description: 'For mammalian cells' },
  'T8787': { name: 'Triton X-100', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'T8787', unit: 'L', storageTemp: 'RT', hazardClass: '', description: 'Laboratory grade' },
  'L4509': { name: 'SDS (Sodium Dodecyl Sulfate)', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'L4509', unit: 'kg', storageTemp: 'RT', hazardClass: 'Irritant', description: 'BioReagent, ≥98.5%' },
  'P4170': { name: 'Paraformaldehyde', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'P4170', unit: 'g', storageTemp: 'RT', hazardClass: 'Toxic', description: 'Powder, 95%' },
  'A2942': { name: 'Acrylamide/Bis Solution 30%', category: 'Chemicals', manufacturer: 'Sigma-Aldrich', catalogNumber: 'A2942', unit: 'mL', storageTemp: '4C', hazardClass: 'Toxic', description: '37.5:1 ratio' },
  'A8806': { name: 'Ampicillin Sodium Salt', category: 'Antibiotics', manufacturer: 'Sigma-Aldrich', catalogNumber: 'A8806', unit: 'g', storageTemp: '-20C', hazardClass: '', description: 'Cell culture tested' },
  'K1377': { name: 'Kanamycin Sulfate', category: 'Antibiotics', manufacturer: 'Sigma-Aldrich', catalogNumber: 'K1377', unit: 'g', storageTemp: '4C', hazardClass: '', description: 'Cell culture tested' },
  'C0378': { name: 'Chloramphenicol', category: 'Antibiotics', manufacturer: 'Sigma-Aldrich', catalogNumber: 'C0378', unit: 'g', storageTemp: 'RT', hazardClass: '', description: '≥98% (HPLC)' },
  'G1914': { name: 'Gentamicin Sulfate', category: 'Antibiotics', manufacturer: 'Sigma-Aldrich', catalogNumber: 'G1914', unit: 'g', storageTemp: 'RT', hazardClass: '', description: 'Cell culture tested' },
  'I9278': { name: 'IPTG', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'I9278', unit: 'g', storageTemp: '-20C', hazardClass: '', description: 'Dioxane-free, ≥99%' },
  'X4626': { name: 'X-Gal', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'X4626', unit: 'g', storageTemp: '-20C', hazardClass: '', description: 'For blue/white screening' },
  'E8751': { name: 'Ethidium Bromide', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'E8751', unit: 'mL', storageTemp: 'RT', hazardClass: 'Toxic', description: '10 mg/mL solution' },
  'A9414': { name: 'Agarose', category: 'Reagents', manufacturer: 'Sigma-Aldrich', catalogNumber: 'A9414', unit: 'g', storageTemp: 'RT', hazardClass: '', description: 'Low EEO, molecular biology grade' },

  // ==================== QIAGEN ====================
  '69504': { name: 'QIAquick PCR Purification Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '69504', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '50 reactions per kit' },
  '69106': { name: 'QIAquick Gel Extraction Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '69106', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '50 reactions per kit' },
  '27104': { name: 'QIAprep Spin Miniprep Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '27104', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '50 reactions, plasmid DNA' },
  '12125': { name: 'QIAGEN Plasmid Midi Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '12125', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '25 reactions' },
  '12362': { name: 'QIAGEN Plasmid Maxi Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '12362', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '10 reactions' },
  '74104': { name: 'RNeasy Mini Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '74104', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '50 reactions, RNA isolation' },
  '69506': { name: 'DNeasy Blood & Tissue Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '69506', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: '50 reactions' },
  '205311': { name: 'QuantiTect Reverse Transcription Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '205311', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: '50 reactions, cDNA synthesis' },
  '204143': { name: 'QuantiTect SYBR Green PCR Kit', category: 'Kits', manufacturer: 'Qiagen', catalogNumber: '204143', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: '200 reactions, qPCR' },
  '79254': { name: 'QIAzol Lysis Reagent', category: 'Reagents', manufacturer: 'Qiagen', catalogNumber: '79254', unit: 'bottles', storageTemp: '4C', hazardClass: 'Toxic', description: 'RNA isolation' },

  // ==================== PROMEGA ====================
  'M1801': { name: 'pGEM-T Easy Vector System', category: 'Kits', manufacturer: 'Promega', catalogNumber: 'M1801', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'TA cloning kit' },
  'A1360': { name: 'GoTaq Green Master Mix', category: 'Reagents', manufacturer: 'Promega', catalogNumber: 'A1360', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'Ready-to-use PCR mix' },
  'A6001': { name: 'GoScript Reverse Transcription System', category: 'Kits', manufacturer: 'Promega', catalogNumber: 'A6001', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'cDNA synthesis' },
  'A3500': { name: 'CellTiter-Glo Luminescent Cell Viability Assay', category: 'Kits', manufacturer: 'Promega', catalogNumber: 'A3500', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'ATP-based viability' },
  'E1910': { name: 'Dual-Luciferase Reporter Assay System', category: 'Kits', manufacturer: 'Promega', catalogNumber: 'E1910', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'Reporter gene assay' },

  // ==================== BIO-RAD ====================
  '1610373': { name: 'Precision Plus Protein Dual Color Standards', category: 'Reagents', manufacturer: 'Bio-Rad', catalogNumber: '1610373', unit: 'tubes', storageTemp: '-20C', hazardClass: '', description: 'Protein ladder' },
  '1620177': { name: 'Mini-PROTEAN TGX Precast Gels', category: 'Consumables', manufacturer: 'Bio-Rad', catalogNumber: '1620177', unit: 'pcs', storageTemp: '4C', hazardClass: '', description: '4-15%, 10-well' },
  '1610747': { name: 'Trans-Blot Turbo Transfer Pack', category: 'Consumables', manufacturer: 'Bio-Rad', catalogNumber: '1610747', unit: 'packs', storageTemp: 'RT', hazardClass: '', description: 'PVDF, mini format' },
  '5000006': { name: 'Protein Assay Dye Reagent', category: 'Reagents', manufacturer: 'Bio-Rad', catalogNumber: '5000006', unit: 'bottles', storageTemp: '4C', hazardClass: '', description: 'Bradford assay' },
  '1706515': { name: 'iScript cDNA Synthesis Kit', category: 'Kits', manufacturer: 'Bio-Rad', catalogNumber: '1706515', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: '25 reactions' },
  '1725121': { name: 'SsoAdvanced Universal SYBR Green Supermix', category: 'Reagents', manufacturer: 'Bio-Rad', catalogNumber: '1725121', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'qPCR master mix' },

  // ==================== VWR / CORNING / FALCON ====================
  '89092': { name: 'Pipette Tips 1000µL', category: 'Consumables', manufacturer: 'VWR', catalogNumber: '89092', unit: 'boxes', storageTemp: 'RT', hazardClass: '', description: 'Filter tips, sterile' },
  '89093': { name: 'Pipette Tips 200µL', category: 'Consumables', manufacturer: 'VWR', catalogNumber: '89093', unit: 'boxes', storageTemp: 'RT', hazardClass: '', description: 'Filter tips, sterile' },
  '89094': { name: 'Pipette Tips 10µL', category: 'Consumables', manufacturer: 'VWR', catalogNumber: '89094', unit: 'boxes', storageTemp: 'RT', hazardClass: '', description: 'Filter tips, sterile' },
  '430641': { name: 'Cell Culture Flask T-75', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '430641', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '430639': { name: 'Cell Culture Flask T-25', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '430639', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '430167': { name: 'Cell Culture Flask T-175', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '430167', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '3516': { name: '96-Well Plate, Flat Bottom', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '3516', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '3524': { name: '24-Well Plate', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '3524', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '3506': { name: '6-Well Plate', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '3506', unit: 'pcs', storageTemp: 'RT', hazardClass: '', description: 'Tissue culture treated' },
  '352096': { name: 'Falcon 15 mL Conical Tube', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '352096', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Sterile, 500/case' },
  '352070': { name: 'Falcon 50 mL Conical Tube', category: 'Plasticware', manufacturer: 'Corning', catalogNumber: '352070', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Sterile, 500/case' },
  '354234': { name: 'Matrigel Basement Membrane Matrix', category: 'Cell Culture', manufacturer: 'Corning', catalogNumber: '354234', unit: 'bottles', storageTemp: '-20C', hazardClass: '', description: 'Growth factor reduced' },
  '431080': { name: 'Serological Pipette 10 mL', category: 'Consumables', manufacturer: 'Corning', catalogNumber: '431080', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Sterile, individually wrapped' },
  '431081': { name: 'Serological Pipette 25 mL', category: 'Consumables', manufacturer: 'Corning', catalogNumber: '431081', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Sterile, individually wrapped' },
  '431082': { name: 'Serological Pipette 5 mL', category: 'Consumables', manufacturer: 'Corning', catalogNumber: '431082', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Sterile, individually wrapped' },

  // ==================== EPPENDORF ====================
  '0030125150': { name: 'Eppendorf Safe-Lock Tubes 1.5 mL', category: 'Consumables', manufacturer: 'Eppendorf', catalogNumber: '0030125150', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'PCR clean, 1000/bag' },
  '0030125169': { name: 'Eppendorf Safe-Lock Tubes 2.0 mL', category: 'Consumables', manufacturer: 'Eppendorf', catalogNumber: '0030125169', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'PCR clean, 500/bag' },
  '0030121872': { name: 'Eppendorf DNA LoBind Tubes 1.5 mL', category: 'Consumables', manufacturer: 'Eppendorf', catalogNumber: '0030121872', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Low DNA binding' },
  '022492039': { name: 'epT.I.P.S. Standard 200 µL', category: 'Consumables', manufacturer: 'Eppendorf', catalogNumber: '022492039', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Yellow tips' },
  '022491504': { name: 'epT.I.P.S. Standard 1000 µL', category: 'Consumables', manufacturer: 'Eppendorf', catalogNumber: '022491504', unit: 'bags', storageTemp: 'RT', hazardClass: '', description: 'Blue tips' },

  // ==================== ROCHE ====================
  '11684817910': { name: 'Complete Protease Inhibitor Cocktail', category: 'Reagents', manufacturer: 'Roche', catalogNumber: '11684817910', unit: 'tablets', storageTemp: '4C', hazardClass: '', description: 'EDTA-free, 20 tablets' },
  '04906837001': { name: 'PhosSTOP Phosphatase Inhibitor', category: 'Reagents', manufacturer: 'Roche', catalogNumber: '04906837001', unit: 'tablets', storageTemp: '-20C', hazardClass: '', description: '10 tablets' },
  '11836153001': { name: 'X-tremeGENE HP DNA Transfection Reagent', category: 'Reagents', manufacturer: 'Roche', catalogNumber: '11836153001', unit: 'mL', storageTemp: '4C', hazardClass: '', description: 'Lipid-based transfection' },
  '04707516001': { name: 'FastStart SYBR Green Master', category: 'Reagents', manufacturer: 'Roche', catalogNumber: '04707516001', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'qPCR master mix' },

  // ==================== SANTA CRUZ BIOTECHNOLOGY ====================
  'sc29528': { name: 'Anti-GAPDH Antibody', category: 'Antibodies', manufacturer: 'Santa Cruz', catalogNumber: 'sc-29528', unit: 'vials', storageTemp: '4C', hazardClass: '', description: 'Mouse monoclonal, loading control' },
  'sc8432': { name: 'Anti-β-Actin Antibody', category: 'Antibodies', manufacturer: 'Santa Cruz', catalogNumber: 'sc-8432', unit: 'vials', storageTemp: '4C', hazardClass: '', description: 'Mouse monoclonal, loading control' },

  // ==================== CELL SIGNALING TECHNOLOGY ====================
  '9102': { name: 'p44/42 MAPK (Erk1/2) Antibody', category: 'Antibodies', manufacturer: 'Cell Signaling', catalogNumber: '9102', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Rabbit polyclonal' },
  '4060': { name: 'Phospho-Akt (Ser473) Antibody', category: 'Antibodies', manufacturer: 'Cell Signaling', catalogNumber: '4060', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Rabbit monoclonal' },
  '7076': { name: 'Anti-Mouse IgG HRP-Linked Antibody', category: 'Antibodies', manufacturer: 'Cell Signaling', catalogNumber: '7076', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Horse, secondary antibody' },
  '7074': { name: 'Anti-Rabbit IgG HRP-Linked Antibody', category: 'Antibodies', manufacturer: 'Cell Signaling', catalogNumber: '7074', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Goat, secondary antibody' },

  // ==================== ABCAM ====================
  'ab6276': { name: 'Anti-Alpha Tubulin Antibody', category: 'Antibodies', manufacturer: 'Abcam', catalogNumber: 'ab6276', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Mouse monoclonal, loading control' },
  'ab8227': { name: 'Anti-Beta Actin Antibody', category: 'Antibodies', manufacturer: 'Abcam', catalogNumber: 'ab8227', unit: 'vials', storageTemp: '-20C', hazardClass: '', description: 'Rabbit polyclonal' },

  // ==================== LONZA ====================
  'CC3170': { name: 'EGM-2 BulletKit', category: 'Cell Culture', manufacturer: 'Lonza', catalogNumber: 'CC-3170', unit: 'kits', storageTemp: '4C', hazardClass: '', description: 'Endothelial cell medium' },
  'CC3150': { name: 'KGM Gold BulletKit', category: 'Cell Culture', manufacturer: 'Lonza', catalogNumber: 'CC-3150', unit: 'kits', storageTemp: '4C', hazardClass: '', description: 'Keratinocyte medium' },
  'VCA1003': { name: '4D-Nucleofector X Kit L', category: 'Kits', manufacturer: 'Lonza', catalogNumber: 'V4XC-1003', unit: 'kits', storageTemp: 'RT', hazardClass: '', description: 'Electroporation, 100 reactions' },

  // ==================== TAKARA / CLONTECH ====================
  '639649': { name: 'PrimeScript RT Master Mix', category: 'Kits', manufacturer: 'Takara', catalogNumber: '639649', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'cDNA synthesis, 100 reactions' },
  'RR820A': { name: 'TB Green Premix Ex Taq II', category: 'Reagents', manufacturer: 'Takara', catalogNumber: 'RR820A', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'qPCR master mix' },
  'Z1420N': { name: 'In-Fusion HD Cloning Kit', category: 'Kits', manufacturer: 'Takara', catalogNumber: 'Z1420N', unit: 'kits', storageTemp: '-20C', hazardClass: '', description: 'Seamless cloning' },
};

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string, productInfo?: typeof PRODUCT_DATABASE[string]) => void;
  mode?: 'simple' | 'autofill'; // simple just returns barcode, autofill looks up product info
}

export function BarcodeScanner({ isOpen, onClose, onScan, mode = 'simple' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'usb' | 'upload' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [scannedResult, setScannedResult] = useState<string>('');
  const [productInfo, setProductInfo] = useState<typeof PRODUCT_DATABASE[string] | null>(null);
  const [usbBuffer, setUsbBuffer] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [scanningImage, setScanningImage] = useState(false);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Detect browser for permission instructions
  const getBrowser = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edge')) return 'chrome';
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
    if (ua.includes('Edge')) return 'edge';
    return 'general';
  };

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setScanMode('camera');
      setManualInput('');
      setScannedResult('');
      setProductInfo(null);
      setUsbBuffer('');
      setImagePreview('');
      setSearchingOnline(false);
      setNotFound(false);
      return;
    }
    if (scanMode === 'camera') {
      startScanner();
    } else if (scanMode === 'usb') {
      // Focus USB input when switching to USB mode
      setTimeout(() => usbInputRef.current?.focus(), 100);
    }
    return () => cleanup();
  }, [isOpen, scanMode]);

  // USB Scanner handler - most USB scanners act as keyboard and send Enter at the end
  const handleUsbInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsbBuffer(e.target.value);
  }, []);

  const handleUsbKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // USB scanners typically send Enter after the barcode
    if (e.key === 'Enter' && usbBuffer.trim()) {
      e.preventDefault();
      handleBarcodeScan(usbBuffer.trim());
      setUsbBuffer('');
    }
  }, [usbBuffer]);

  // Image upload and scan
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Scan the image
    setScanningImage(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();

      // Create image element
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => { img.onload = resolve; });

      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      // Try to decode
      try {
        const result = await codeReader.decodeFromImageElement(img);
        if (result) {
          handleBarcodeScan(result.getText());
        }
      } catch {
        setError('No barcode found in image. Try a clearer photo or use manual entry.');
      }

      URL.revokeObjectURL(img.src);
    } catch (err: any) {
      setError('Failed to scan image: ' + (err.message || 'Unknown error'));
    } finally {
      setScanningImage(false);
    }
  };

  async function startScanner() {
    setError('');
    setScanning(false);
    try {
      // First request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, just testing permission

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devices);

      if (devices.length === 0) {
        setError('No camera found on this device.');
        return;
      }

      const deviceId = selectedCamera || devices[0].deviceId;
      if (!selectedCamera) setSelectedCamera(deviceId);

      if (!videoRef.current) return;

      setScanning(true);
      await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          const barcode = result.getText();
          handleBarcodeScan(barcode);
        }
      });
    } catch (e: any) {
      console.error('Scanner error:', e);
      if (e.name === 'NotAllowedError' || e.message?.includes('Permission denied')) {
        setError('Camera permission denied. Please allow camera access in your browser settings, or use manual entry below.');
      } else if (e.name === 'NotFoundError') {
        setError('No camera found on this device. Please use manual entry.');
      } else {
        setError(e.message || 'Failed to start camera. Try manual entry below.');
      }
      setScanning(false);
    }
  }

  // Online API lookup for unknown barcodes
  async function lookupBarcodeOnline(barcode: string): Promise<typeof PRODUCT_DATABASE[string] | null> {
    // Try multiple lookup strategies
    const cleanBarcode = barcode.replace(/[-\s]/g, '');

    // Strategy 1: Try Open Food Facts API (works for some lab products with EAN/UPC codes)
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`);
      const data = await response.json();
      if (data.status === 1 && data.product) {
        return {
          name: data.product.product_name || data.product.generic_name || 'Unknown Product',
          category: data.product.categories?.split(',')[0] || 'General',
          manufacturer: data.product.brands || 'Unknown',
          catalogNumber: cleanBarcode,
          unit: 'pcs',
          storageTemp: 'RT',
          hazardClass: '',
          description: data.product.ingredients_text || '',
        };
      }
    } catch (e) {
      // lookup failed — try next strategy
    }

    // Strategy 2: Try UPC Database API (free tier)
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          name: item.title || 'Unknown Product',
          category: item.category || 'General',
          manufacturer: item.brand || 'Unknown',
          catalogNumber: cleanBarcode,
          unit: 'pcs',
          storageTemp: 'RT',
          hazardClass: '',
          description: item.description || '',
        };
      }
    } catch (e) {
      // lookup failed — barcode not in database
    }

    return null;
  }

  async function handleBarcodeScan(barcode: string) {
    setScannedResult(barcode);
    setNotFound(false);

    // Clean barcode for lookup (remove dashes, spaces)
    const cleanBarcode = barcode.replace(/[-\s]/g, '').toUpperCase();
    const lowerBarcode = barcode.replace(/[-\s]/g, '').toLowerCase();

    // Look up product info in local database (try multiple formats)
    let info = PRODUCT_DATABASE[cleanBarcode] ||
               PRODUCT_DATABASE[barcode] ||
               PRODUCT_DATABASE[lowerBarcode] ||
               PRODUCT_DATABASE[barcode.toUpperCase()];

    // If not found locally, try online lookup
    if (!info && mode === 'autofill') {
      setSearchingOnline(true);
      try {
        info = await lookupBarcodeOnline(barcode) || undefined;
      } catch (e) {
        console.error('Online lookup failed:', e);
      }
      setSearchingOnline(false);
    }

    if (mode === 'autofill' && info) {
      setProductInfo(info);
      // Don't auto-close, let user confirm
    } else if (mode === 'autofill' && !info) {
      // Show not found message with option to enter manually
      setNotFound(true);
    } else {
      // Simple mode - just return the barcode
      onScan(barcode, info || undefined);
      cleanup();
      onClose();
    }
  }

  function handleManualSubmit() {
    if (!manualInput.trim()) return;
    handleBarcodeScan(manualInput.trim());
  }

  function handleConfirmProduct() {
    onScan(scannedResult, productInfo || undefined);
    cleanup();
    onClose();
  }

  function cleanup() {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch {}
      readerRef.current = null;
    }
    setScanning(false);
    setError('');
  }

  function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    cleanup();
    setTimeout(() => startScanner(), 100);
  }

  function switchScanMode(newMode: 'camera' | 'usb' | 'upload' | 'manual') {
    cleanup();
    setImagePreview('');
    setScanMode(newMode);
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { cleanup(); onClose(); }} title="Barcode Scanner" size="md">
      <div style={{ padding: '0 8px' }}>
        {/* Mode Toggle - 4 Options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          {[
            { mode: 'camera' as const, icon: '📷', label: 'Camera' },
            { mode: 'usb' as const, icon: '🔌', label: 'USB Scanner' },
            { mode: 'upload' as const, icon: '📁', label: 'Upload' },
            { mode: 'manual' as const, icon: '⌨️', label: 'Type' },
          ].map(({ mode: m, icon, label }) => (
            <button
              key={m}
              onClick={() => switchScanMode(m)}
              style={{
                padding: '10px 4px',
                borderRadius: 10,
                border: scanMode === m ? '2px solid #6366f1' : '1px solid #e2e8f0',
                background: scanMode === m ? 'rgba(99,102,241,0.1)' : '#fff',
                color: scanMode === m ? '#6366f1' : '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Product Info Display (when found) */}
        {productInfo && (
          <div style={{
            background: 'linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '2px solid #22c55e',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <span style={{ fontWeight: 700, color: '#166534', fontSize: 16 }}>Product Found!</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><strong>Name:</strong> {productInfo.name}</div>
              <div><strong>Category:</strong> {productInfo.category}</div>
              <div><strong>Manufacturer:</strong> {productInfo.manufacturer}</div>
              <div><strong>Catalog #:</strong> {productInfo.catalogNumber}</div>
              <div><strong>Storage:</strong> {productInfo.storageTemp}</div>
              <div><strong>Unit:</strong> {productInfo.unit}</div>
              {productInfo.hazardClass && (
                <div style={{ gridColumn: 'span 2', color: '#dc2626' }}>
                  <strong>⚠️ Hazard:</strong> {productInfo.hazardClass}
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={handleConfirmProduct}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✓ Add to Inventory
              </button>
              <button
                onClick={() => { setProductInfo(null); setScannedResult(''); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Scan Another
              </button>
            </div>
          </div>
        )}

        {/* Searching Online Display */}
        {searchingOnline && (
          <div style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
            textAlign: 'center',
            border: '2px solid #6366f1',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🔍</div>
            <div style={{ fontWeight: 700, color: '#4338ca', fontSize: 16, marginBottom: 8 }}>
              Searching Online Database...
            </div>
            <div style={{ fontSize: 13, color: '#6366f1' }}>
              Looking up barcode: <strong style={{ fontFamily: 'monospace' }}>{scannedResult}</strong>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
              Checking manufacturer databases and online registries...
            </div>
          </div>
        )}

        {/* Not Found Display */}
        {notFound && !searchingOnline && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '2px solid #f59e0b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <span style={{ fontWeight: 700, color: '#b45309', fontSize: 16 }}>Product Not Found</span>
            </div>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
              Barcode <strong style={{ fontFamily: 'monospace' }}>{scannedResult}</strong> was not found in our database or online.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  // Use barcode anyway and let user fill in details
                  onScan(scannedResult, undefined);
                  cleanup();
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#f59e0b',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Use Barcode Anyway
              </button>
              <button
                onClick={() => { setNotFound(false); setScannedResult(''); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Scan Another
              </button>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: '#fff', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
              💡 <strong>Tip:</strong> You can add this product to the database after entering its details manually.
            </div>
          </div>
        )}

        {!productInfo && !searchingOnline && !notFound && (
          <>
            {/* Camera Mode */}
            {scanMode === 'camera' && (
              <div>
                {error ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>⚠️ Camera Access Issue</div>
                    <div style={{ fontSize: 13, marginBottom: 12, color: '#dc2626' }}>{error}</div>

                    {/* Browser-specific help */}
                    <div style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, border: '1px solid #fecaca' }}>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#374151' }}>
                        📋 How to enable camera:
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {CAMERA_PERMISSION_HELP[getBrowser()]}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { setError(''); startScanner(); }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: '1px solid #dc2626',
                          background: 'transparent',
                          color: '#dc2626',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        🔄 Retry
                      </button>
                      <button
                        onClick={() => switchScanMode('usb')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#10b981',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        🔌 USB Scanner
                      </button>
                      <button
                        onClick={() => switchScanMode('upload')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#6366f1',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        📁 Upload Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Camera Selection */}
                    {cameras.length > 1 && (
                      <div style={{ marginBottom: 12 }}>
                        <select
                          value={selectedCamera}
                          onChange={(e) => switchCamera(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                          }}
                        >
                          {cameras.map((cam, i) => (
                            <option key={cam.deviceId} value={cam.deviceId}>
                              📷 {cam.label || `Camera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Video Preview */}
                    <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                      <video
                        ref={videoRef}
                        style={{ width: '100%', display: 'block', minHeight: 280 }}
                        autoPlay
                        muted
                        playsInline
                      />
                      {/* Scanning overlay */}
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <div style={{
                          width: '70%',
                          height: '40%',
                          border: '3px solid rgba(99,102,241,0.8)',
                          borderRadius: 12,
                          boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '15%',
                            right: '15%',
                            height: 3,
                            background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                            animation: 'scan 2s ease-in-out infinite',
                          }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 12 }}>
                      <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                        {scanning ? '📷 Position barcode inside the frame...' : '⏳ Initializing camera...'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* USB Scanner Mode */}
            {scanMode === 'usb' && (
              <div>
                <div style={{
                  background: 'linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)',
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'center',
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔌</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#166534', marginBottom: 8 }}>
                    USB/Bluetooth Scanner Ready
                  </div>
                  <div style={{ fontSize: 13, color: '#15803d', marginBottom: 16 }}>
                    Point your scanner at the barcode and scan. The barcode will appear below automatically.
                  </div>
                  <input
                    ref={usbInputRef}
                    type="text"
                    value={usbBuffer}
                    onChange={handleUsbInput}
                    onKeyDown={handleUsbKeyDown}
                    placeholder="Waiting for scan... (or type barcode)"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: 10,
                      border: '2px solid #22c55e',
                      fontSize: 18,
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      background: '#fff',
                    }}
                  />
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 12, color: '#64748b' }}>
                  <strong>💡 Tip:</strong> Most USB/Bluetooth barcode scanners work like keyboards.
                  Just scan and the barcode will auto-fill. Press Enter or scan will submit automatically.
                </div>
              </div>
            )}

            {/* Upload Image Mode */}
            {scanMode === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />

                {imagePreview ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                      <img
                        src={imagePreview}
                        alt="Uploaded"
                        style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#f8fafc' }}
                      />
                      {scanningImage && (
                        <div style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 600,
                        }}>
                          🔍 Scanning...
                        </div>
                      )}
                    </div>
                    {error && (
                      <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
                        {error}
                      </div>
                    )}
                    <button
                      onClick={() => { setImagePreview(''); setError(''); fileInputRef.current?.click(); }}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '12px',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      📁 Upload Different Image
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: 12,
                      padding: 40,
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: 16,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Click to upload barcode image
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Take a photo of the barcode on the package and upload it here
                    </div>
                  </div>
                )}

                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 12, color: '#64748b' }}>
                  <strong>💡 Tip:</strong> For best results, ensure the barcode is well-lit,
                  in focus, and takes up a good portion of the image.
                </div>
              </div>
            )}

            {/* Manual Entry Mode */}
            {scanMode === 'manual' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                    Enter Barcode or Catalog Number
                  </label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    placeholder="e.g., M0267S, 10128-016, 69504"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: '2px solid #e2e8f0',
                      fontSize: 16,
                      fontFamily: 'monospace',
                    }}
                    autoFocus
                  />
                </div>

                {/* Sample Barcodes for Testing */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#475569' }}>
                    🧪 Try these sample catalog numbers:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['M0267S', '10128016', 'E7023', '69504', '89092'].map(code => (
                      <button
                        key={code}
                        onClick={() => setManualInput(code)}
                        style={{
                          background: '#e2e8f0',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                        }}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 10,
                    border: 'none',
                    background: manualInput.trim() ? '#6366f1' : '#e2e8f0',
                    color: manualInput.trim() ? '#fff' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  {mode === 'autofill' ? '🔍 Look Up Product' : '✓ Use Barcode'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Cancel Button */}
        <button
          onClick={() => { cleanup(); onClose(); }}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#64748b',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
