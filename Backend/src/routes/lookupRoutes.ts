import { Router } from 'express';

import {
  getClimateRegions,
  getDhwSystems,
  getElevatorTypes,
  getEnvelopeConfigLookup,
  getFormulaCatalog,
  getFullConfigLookup,
  getGlazingTypes,
  getHvacSystems,
  getLightingSystems,
  getMepConfigLookup,
  getProjectConfigLookup,
  getRoofConstructions,
  getShadingTypes,
  getStepGuide,
  getUseCategories,
  getWallConstructions,
} from '../controllers/lookupController.js';
import { getMeasureLibrary } from '../controllers/optimizationController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/reference/measures', requireAuth, getMeasureLibrary);
router.get('/lookup/config', requireAuth, getFullConfigLookup);
router.get('/lookup/project', requireAuth, getProjectConfigLookup);
router.get('/lookup/envelope', requireAuth, getEnvelopeConfigLookup);
router.get('/lookup/mep', requireAuth, getMepConfigLookup);
router.get('/lookup/climate-regions', requireAuth, getClimateRegions);
router.get('/lookup/use-categories', requireAuth, getUseCategories);
router.get('/lookup/wall-constructions', requireAuth, getWallConstructions);
router.get('/lookup/roof-constructions', requireAuth, getRoofConstructions);
router.get('/lookup/glazing-types', requireAuth, getGlazingTypes);
router.get('/lookup/shading-types', requireAuth, getShadingTypes);
router.get('/lookup/hvac-systems', requireAuth, getHvacSystems);
router.get('/lookup/lighting-systems', requireAuth, getLightingSystems);
router.get('/lookup/elevator-types', requireAuth, getElevatorTypes);
router.get('/lookup/dhw-systems', requireAuth, getDhwSystems);
router.get('/lookup/steps', requireAuth, getStepGuide);
router.get('/lookup/formulas', requireAuth, getFormulaCatalog);

export default router;
