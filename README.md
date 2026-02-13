# SeedScan OCR Engine (Backend)

Microservice backend : **Upload → Google Vision OCR → MongoDB → API**.

- Reçoit des fichiers (PDF, JPG, PNG, TIFF)
- Envoie à Google Cloud Vision OCR
- Stocke la réponse brute et les métadonnées dans MongoDB
- Expose une API REST pour upload, lancer l’OCR, consulter les résultats et l’historique

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

Tous les endpoints `/api/ocr/*` sont protégés : envoyer soit l’header **`X-API-Key: <votre API_KEY>`**, soit **`Authorization: Bearer <JWT>`**.

## Tester avec Postman

1. **Upload** : POST `http://localhost:3000/api/ocr/upload`  
   - Body : form-data, champ `file` (fichier), `schoolId` (texte), `uploadedBy` (optionnel)  
   - Header : `X-API-Key: <votre API_KEY>`
2. **Lancer l’OCR** : POST `http://localhost:3000/api/ocr/process/<id>` avec le même header.
3. **Résultat** : GET `http://localhost:3000/api/ocr/result/<id>`
4. **Liste** : GET `http://localhost:3000/api/ocr/list?schoolId=xxx`

## Documentation Swagger

Une fois le serveur démarré : **http://localhost:3000/api-docs**

## Limites

- Taille max d’upload configurable via `UPLOAD_MAX_SIZE_MB` (défaut 20 MB).
- Les PDF sont envoyés à Vision en tant qu’image ; pour les PDF multi-pages volumineux, une intégration type batch / GCS peut être ajoutée plus tard.
