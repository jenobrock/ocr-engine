# SeedScan OCR Engine (Backend)

Microservice backend : **Upload → OCR (Google Vision) → MongoDB (raw) → AI Cleaning (OpenAI) → MongoDB (cleaned)**.

- Reçoit des fichiers (PDF, JPG, PNG, TIFF)
- Envoie à Google Cloud Vision OCR
- Stocke la réponse brute et les métadonnées dans MongoDB
- **Module IA** : nettoyage, structuration et validation des textes OCR via OpenAI ; génération de schéma ; stockage dans `raw_documents` et `cleaned_documents`
- Expose une API REST pour upload, OCR, résultats OCR, et **AI cleaning** (process, result, list)

## Prérequis

- Node.js 18+
- MongoDB (local ou distant)
- Compte Google Cloud avec **Vision API** activé et un fichier de credentials (compte de service JSON)

## Installation

```bash
cd school/ocr-engine
npm install
```

## Configuration

1. Copier `.env.example` vers `.env`
2. Remplir les variables :
   - `MONGODB_URI` : URI de connexion MongoDB
   - `GOOGLE_APPLICATION_CREDENTIALS` : chemin absolu vers le fichier JSON du compte de service Google
   - `API_KEY` ou `JWT_SECRET` : au moins un des deux pour protéger l’API
- `OPENAI_API_KEY` : clé API OpenAI pour le module de cleaning/structuration

## Lancer l’API

```bash
npm run dev
```

L’API écoute par défaut sur `http://localhost:3000`.

## Endpoints

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | Santé (sans auth) |
| POST | `/api/ocr/upload` | Upload d’un fichier (form-data: `file`, `schoolId`, `uploadedBy` optionnel) |
| POST | `/api/ocr/process/:id` | Lancer l’OCR pour le document `id` |
| GET | `/api/ocr/result/:id` | Récupérer le résultat OCR complet |
| GET | `/api/ocr/list?schoolId=xxx` | Liste paginée (query: `schoolId`, optionnel: `status`, `limit`, `offset`) |
| POST | `/api/ai-cleaning/process/:ocrDocumentId` | Lancer le cleaning IA sur un document OCR (body optionnel : `documentType`, `country`, `language`) |
| GET | `/api/ai-cleaning/result/:id` | Résultat du cleaning (cleaned_data, schema, confidence, status) |
| GET | `/api/ai-cleaning/list` | Liste des documents nettoyés (query : `ocrDocumentId`, `status`, `limit`, `offset`) |

Tous les endpoints `/api/ocr/*` et `/api/ai-cleaning/*` sont protégés : envoyer soit l’header **`X-API-Key: <votre API_KEY>`**, soit **`Authorization: Bearer <JWT>`**.

## Tester avec Postman

1. **Upload** : POST `http://localhost:3000/api/ocr/upload`  
   - Body : form-data, champ `file` (fichier), `schoolId` (texte), `uploadedBy` (optionnel)  
   - Header : `X-API-Key: <votre API_KEY>`
2. **Lancer l’OCR** : POST `http://localhost:3000/api/ocr/process/<id>` avec le même header.
3. **Résultat** : GET `http://localhost:3000/api/ocr/result/<id>`
4. **Liste** : GET `http://localhost:3000/api/ocr/list?schoolId=xxx`

**AI Cleaning** (après qu’un document soit en statut `processed`) :
5. **Lancer le cleaning** : POST `http://localhost:3000/api/ai-cleaning/process/<ocrDocumentId>` avec body optionnel `{ "documentType": "school" }`
6. **Résultat cleaning** : GET `http://localhost:3000/api/ai-cleaning/result/<cleanedDocumentId>`
7. **Liste cleaning** : GET `http://localhost:3000/api/ai-cleaning/list?ocrDocumentId=xxx`

## Documentation Swagger

Une fois le serveur démarré : **http://localhost:3000/api-docs**

## Limites

- Taille max d’upload configurable via `UPLOAD_MAX_SIZE_MB` (défaut 20 MB).
- Les PDF sont envoyés à Vision en tant qu’image ; pour les PDF multi-pages volumineux, une intégration type batch / GCS peut être ajoutée plus tard.
- AI Cleaning : le texte envoyé à OpenAI est tronqué à `AI_CLEANING_MAX_CHARS` (défaut 12 000 caractères). Si `confidence` &lt; 0,8, le document est en `needs_review`.
