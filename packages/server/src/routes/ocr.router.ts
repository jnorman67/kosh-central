import { Router } from 'express';
import { findBundleById } from '../db/bundles.store.js';
import { findOcrByBundleId } from '../db/ocr.store.js';

export function createOcrRouter(): Router {
    const router = Router();

    router.get('/:bundleId', (req, res) => {
        const bundle = findBundleById(req.params.bundleId);
        if (!bundle) {
            res.status(404).json({ error: 'Bundle not found' });
            return;
        }
        const result = findOcrByBundleId(req.params.bundleId);
        if (!result) {
            res.status(404).json({ error: 'No OCR result for this bundle' });
            return;
        }
        res.json(result);
    });

    return router;
}
