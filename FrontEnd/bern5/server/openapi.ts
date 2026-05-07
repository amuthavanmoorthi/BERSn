/**
 * OpenAPI 3.0 spec for the Bern5 API.
 * Served at /api/docs (Swagger UI) and /api/openapi.json (raw spec).
 *
 * Keep this in sync as routes evolve. Sections marked "(planned)" are coming
 * in later PRs and are documented here so the contract is visible early.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Bern5 API',
    version: '0.2.0',
    description:
      '建築能源分析平台後端。每個專案會在 `data/projects/<id>.sqlite` 對應一個獨立的 SQLite 檔案；`_index.sqlite` 為集中索引以加速列表。',
  },
  servers: [
    { url: 'http://localhost:5174', description: 'Local API (direct)' },
    { url: '/', description: 'Via Vite proxy (/api/*)' },
  ],
  tags: [
    { name: 'health',     description: '服務健康檢查' },
    { name: 'projects',   description: '專案 CRUD（中央索引 + 每專案 SQLite）' },
    { name: 'modeling',   description: '3D 樓層 / 形狀持久化（PR3）' },
    { name: 'calc',       description: '能源計算 API — geometry/envelope summary, inputs（PR4）' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['health'],
        summary: '健康檢查',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    projectCount: { type: 'integer' },
                    ts: { type: 'integer', description: 'Unix ms' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/projects': {
      get: {
        tags: ['projects'],
        summary: '列出所有專案',
        description: '從 _index.sqlite 讀取，按 updated_at 倒序排列。',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['projects'],
        summary: '建立新專案',
        description: '同時建立 `_index.sqlite` 索引列與 `data/projects/<id>.sqlite` 檔案。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProjectFormData' },
              examples: {
                office: {
                  value: {
                    name: '綠能大樓原型',
                    organization: '桃園市政府',
                    location: '桃園市中壢區',
                    buildingType: 'office',
                    totalArea: 5000,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { project: { $ref: '#/components/schemas/Project' } },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },

    '/api/projects/{id}': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['projects'],
        summary: '取得單一專案 metadata',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { project: { $ref: '#/components/schemas/Project' } },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['projects'],
        summary: '更新專案 metadata',
        description: '部分更新；只有提供的欄位會被寫入。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:         { type: 'string' },
                  organization: { type: 'string' },
                  location:     { type: 'string' },
                  status:       { type: 'string', enum: ['draft', 'in-progress', 'completed'] },
                  category:     { type: 'string' },
                  buildingType: { type: 'string' },
                  totalArea:    { type: 'number' },
                  grade:        { type: 'string' },
                  eei:          { type: 'number' },
                  thumbnail:    { type: 'string', description: 'base64 PNG / data URL' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { project: { $ref: '#/components/schemas/Project' } },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['projects'],
        summary: '刪除專案',
        description: '同時刪除 `_index.sqlite` 索引列與 `data/projects/<id>.sqlite` 檔案（含 -wal/-shm）。',
        responses: {
          204: { description: 'No Content' },
        },
      },
    },

    '/api/projects/{id}/floors': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['modeling'],
        summary: '載入專案 3D 樓層',
        description: '從 per-project SQLite 讀取樓層 + 形狀並 join 後回傳。',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { floors: { type: 'array', items: { $ref: '#/components/schemas/Floor' } } },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['modeling'],
        summary: '儲存專案 3D 樓層',
        description: '完整覆寫（DELETE + INSERT 在一個 transaction 內）。前端呼叫已 debounce 500ms。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { floors: { type: 'array', items: { $ref: '#/components/schemas/Floor' } } },
                required: ['floors'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Saved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok:         { type: 'boolean' },
                    floorCount: { type: 'integer' },
                    shapeCount: { type: 'integer' },
                    updatedAt:  { type: 'integer', description: 'Unix ms' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/projects/{id}/calc/inputs': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['calc'],
        summary: '能源公式輸入快照（★ 對外穩定契約）',
        description: '回傳已正規化的計算輸入（project / geometry / envelope / params）。能源公式只要呼叫這支即可，不必懂 3D 編輯器內部結構。',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CalcInputs' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/projects/{id}/calc/geometry-summary': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['calc'],
        summary: '幾何摘要',
        description: '每樓 union 面積、周長、外牆/內牆共邊長度。',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GeometrySummary' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/projects/{id}/calc/envelope-summary': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['calc'],
        summary: '外殼摘要',
        description: '牆/窗/屋頂面積、玻璃 / 遮陽組合佔比、加權 U 值與 η 值。',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EnvelopeSummary' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/projects/{id}/calc/params/{group}': {
      parameters: [
        { $ref: '#/components/parameters/ProjectId' },
        {
          name: 'group', in: 'path', required: true,
          schema: { type: 'string', enum: ['baseline', 'envelope', 'mep', 'hvac', 'lighting', 'elevator', 'dhw'] },
        },
      ],
      get: {
        tags: ['calc'],
        summary: '取得單一參數群組（JSON blob）',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    group:     { type: 'string' },
                    value:     { type: 'object', additionalProperties: true, nullable: true },
                    updatedAt: { type: 'integer', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['calc'],
        summary: '寫入單一參數群組',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { value: { type: 'object', additionalProperties: true } },
                required: ['value'],
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/projects/{id}/calc/snapshots': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: { tags: ['calc'], summary: '列出計算快照（最近 50 筆）', responses: { 200: { description: 'OK' } } },
    },
    '/api/projects/{id}/calc/run': {
      post: {
        tags: ['calc'],
        summary: 'Run BERSn energy calculation engine → returns real EEI, Grade, Score, ESR',
        description: 'Reads stored floors/shapes + params from SQLite, calls calculateKPIs(), saves snapshot, updates project_index grade/eei.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Real KPIs from engine',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok:         { type: 'boolean' },
                    snapshotId: { type: 'integer' },
                    computedAt: { type: 'integer' },
                    kpis: {
                      type: 'object',
                      properties: {
                        eei:   { type: 'number' },
                        grade: { type: 'string', enum: ['1+','1','2','3','4','5','6','7'] },
                        score: { type: 'number' },
                        esr:   { type: 'number' },
                        isNZCB: { type: 'boolean' },
                        afe:   { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          422: { description: 'No geometry shapes found — draw shapes first' },
          500: { description: 'Engine error' },
        },
      },
    },

    '/api/projects/{id}/calc/snapshots/{snapshotId}': {
      parameters: [
        { $ref: '#/components/parameters/ProjectId' },
        { name: 'snapshotId', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      get: { tags: ['calc'], summary: '取得單一快照完整內容', responses: { 200: { description: 'OK' }, 404: { $ref: '#/components/responses/NotFound' } } },
    },
  },

  components: {
    parameters: {
      ProjectId: {
        name: 'id',
        in: 'path',
        required: true,
        description: '專案 ID（^[A-Za-z0-9_-]+$，長度 ≤64）',
        schema: { type: 'string', pattern: '^[A-Za-z0-9_-]+$', maxLength: 64 },
        example: 'proj-1730000000-abc123',
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },

      Project: {
        type: 'object',
        properties: {
          id:           { type: 'string' },
          name:         { type: 'string' },
          organization: { type: 'string' },
          location:     { type: 'string' },
          status:       { type: 'string', enum: ['draft', 'in-progress', 'completed'] },
          category:     { type: 'string' },
          buildingType: { type: 'string' },
          totalArea:    { type: 'number' },
          grade:        { type: 'string' },
          eei:          { type: 'number' },
          thumbnail:    { type: 'string' },
          createdAt:    { type: 'string', format: 'date-time' },
          updatedAt:    { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'status', 'createdAt', 'updatedAt'],
      },
      ProjectFormData: {
        type: 'object',
        properties: {
          name:         { type: 'string' },
          organization: { type: 'string' },
          location:     { type: 'string' },
          buildingType: { type: 'string', enum: ['office', 'hospital', 'retail', 'school', 'hotel', 'other'] },
          totalArea:    { type: 'number' },
        },
        required: ['name'],
      },

      // Modeling
      FloorShape: {
        type: 'object',
        description: '單一形狀；params 是型別相關的彈性欄位（wwr/glassType/color/points/...）',
        properties: {
          id:       { type: 'string' },
          type:     {
            type: 'string',
            enum: ['box', 'cylinder', 'polygon', 'lShape', 'tShape', 'arc', 'ellipse', 'fan', 'polyline'],
          },
          position: {
            type: 'object',
            properties: { x: { type: 'number' }, z: { type: 'number' } },
          },
          rotation: { type: 'number', description: 'degrees, CCW' },
          params:   { type: 'object', additionalProperties: true },
        },
        required: ['id', 'type'],
      },
      Floor: {
        type: 'object',
        properties: {
          id:          { type: 'string' },
          name:        { type: 'string' },
          floorHeight: { type: 'number' },
          shapes:      { type: 'array', items: { $ref: '#/components/schemas/FloorShape' } },
        },
        required: ['id', 'name', 'floorHeight', 'shapes'],
      },

      GeometrySummary: {
        type: 'object',
        properties: {
          totalFloorArea: { type: 'number' },
          floorCount:     { type: 'integer' },
          shapeCount:     { type: 'integer' },
          perFloor: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id:                  { type: 'string' },
                name:                { type: 'string' },
                floorHeight:         { type: 'number' },
                area:                { type: 'number' },
                perimeter:           { type: 'number' },
                externalEdgeLength:  { type: 'number' },
                internalEdgeLength:  { type: 'number' },
                shapeCount:          { type: 'integer' },
              },
            },
          },
        },
      },
      EnvelopeSummary: {
        type: 'object',
        properties: {
          totalWallArea:   { type: 'number' },
          totalWindowArea: { type: 'number' },
          totalRoofArea:   { type: 'number' },
          glassMix:        { type: 'object', additionalProperties: { type: 'number' } },
          shadingMix:      { type: 'object', additionalProperties: { type: 'number' } },
          uValueWeighted: {
            type: 'object',
            properties: {
              wall:  { type: 'number', nullable: true },
              glass: { type: 'number', nullable: true },
              roof:  { type: 'number', nullable: true },
            },
          },
          etaWeighted: {
            type: 'object',
            properties: { glass: { type: 'number', nullable: true } },
          },
        },
      },

      CalcInputs: {
        type: 'object',
        properties: {
          project:        { $ref: '#/components/schemas/Project' },
          geometry:       { $ref: '#/components/schemas/GeometrySummary' },
          envelope:       { $ref: '#/components/schemas/EnvelopeSummary' },
          envelopeParams: { type: 'object', additionalProperties: true, nullable: true },
          baseline:       { type: 'object', additionalProperties: true, nullable: true },
          mep:            { type: 'object', additionalProperties: true, nullable: true },
          generatedAt:    { type: 'integer' },
        },
      },
    },
  },
} as const;
