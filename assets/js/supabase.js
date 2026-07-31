/* =========================================================
   SUPABASE CORE
========================================================= */

const SUPABASE_PRIMARY_URL =
  "https://api.aj-77.com"

const SUPABASE_FALLBACK_URL =
  "https://onwjghmlekuydehphkgy.supabase.co"

const SUPABASE_URL =
  SUPABASE_PRIMARY_URL

const SUPABASE_ANON_KEY =
  "sb_publishable_k9IYD_5T8pr5Zy37nqXX_g_S0CZLlrK"

const SUPABASE_ACTIVE_URL_KEY =
  "supabase_active_url_v1"

function getSavedSupabaseUrl() {
  try {
    const saved =
      localStorage.getItem(
        SUPABASE_ACTIVE_URL_KEY
      )

    if (
      saved === SUPABASE_PRIMARY_URL ||
      saved === SUPABASE_FALLBACK_URL
    ) {
      return saved
    }
  } catch {}

  return SUPABASE_PRIMARY_URL
}

let activeSupabaseUrl =
  getSavedSupabaseUrl()

function saveActiveSupabaseUrl(url) {
  if (
    url !== SUPABASE_PRIMARY_URL &&
    url !== SUPABASE_FALLBACK_URL
  ) {
    return
  }

  activeSupabaseUrl = url

  try {
    localStorage.setItem(
      SUPABASE_ACTIVE_URL_KEY,
      url
    )
  } catch {}
}

function getOtherSupabaseUrl(url) {
  return url === SUPABASE_PRIMARY_URL
    ? SUPABASE_FALLBACK_URL
    : SUPABASE_PRIMARY_URL
}

function createSupabaseClient(url) {
  return supabase.createClient(
    url,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  )
}

let db =
  createSupabaseClient(
    activeSupabaseUrl
  )

window.db = db

window.SUPABASE_PRIMARY_URL =
  SUPABASE_PRIMARY_URL

window.SUPABASE_FALLBACK_URL =
  SUPABASE_FALLBACK_URL

window.getActiveSupabaseUrl =
  () => activeSupabaseUrl

/* =========================================================
   CACHE SETTINGS
========================================================= */

const SUPABASE_CACHE_PREFIX = "supabase_cache_v1:"
const SUPABASE_DEFAULT_CACHE_TTL = 5 * 60 * 1000

window.SUPABASE_CACHE_PREFIX =
  SUPABASE_CACHE_PREFIX

window.SUPABASE_DEFAULT_CACHE_TTL =
  SUPABASE_DEFAULT_CACHE_TTL

const supabasePendingRequests = new Map()

/* =========================================================
   CACHE HELPERS
========================================================= */

function createSupabaseCacheKey(table, options = {}) {
  const normalizedOptions = {
    select: options.select || "*",
    filters: options.filters || {},
    order: options.order || null,
    limit: options.limit || null,
    single: options.single || false,
    maybeSingle: options.maybeSingle || false
  }

  return (
    SUPABASE_CACHE_PREFIX +
    table +
    ":" +
    JSON.stringify(normalizedOptions)
  )
}

function readSupabaseCache(cacheKey, ttl = SUPABASE_DEFAULT_CACHE_TTL) {
  try {
    const raw = localStorage.getItem(cacheKey)

    if (!raw) {
      return {
        found: false,
        fresh: false,
        data: null
      }
    }

    const parsed = JSON.parse(raw)

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Object.prototype.hasOwnProperty.call(parsed, "data")
    ) {
      localStorage.removeItem(cacheKey)

      return {
        found: false,
        fresh: false,
        data: null
      }
    }

    const savedAt = Number(parsed.savedAt || 0)
    const age = Date.now() - savedAt
    const fresh = age >= 0 && age < Number(ttl || 0)

    return {
      found: true,
      fresh,
      data: parsed.data,
      savedAt
    }
  } catch (error) {
    console.log("SUPABASE CACHE READ ERROR:", error)

    return {
      found: false,
      fresh: false,
      data: null
    }
  }
}

function writeSupabaseCache(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        savedAt: Date.now()
      })
    )

    return true
  } catch (error) {
    console.log("SUPABASE CACHE WRITE ERROR:", error)
    return false
  }
}

function removeSupabaseCacheKey(cacheKey) {
  try {
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.log("SUPABASE CACHE REMOVE ERROR:", error)
  }
}

function clearSupabaseTableCache(table) {
  const tablePrefix = `${SUPABASE_CACHE_PREFIX}${table}:`

  try {
    const keysToRemove = []

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)

      if (key && key.startsWith(tablePrefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.log("SUPABASE TABLE CACHE CLEAR ERROR:", error)
  }
}

function clearAllSupabaseCache() {
  try {
    const keysToRemove = []

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)

      if (key && key.startsWith(SUPABASE_CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.log("SUPABASE CACHE CLEAR ALL ERROR:", error)
  }
}

/* =========================================================
   QUERY BUILDERS
========================================================= */

function applySupabaseFilters(query, filters = {}) {
  let nextQuery = query

  Object.entries(filters || {}).forEach(([column, filterValue]) => {
    if (
      filterValue &&
      typeof filterValue === "object" &&
      !Array.isArray(filterValue)
    ) {
      const operator = filterValue.operator || "eq"
      const value = filterValue.value

      if (operator === "eq") {
        nextQuery = nextQuery.eq(column, value)
      } else if (operator === "neq") {
        nextQuery = nextQuery.neq(column, value)
      } else if (operator === "gt") {
        nextQuery = nextQuery.gt(column, value)
      } else if (operator === "gte") {
        nextQuery = nextQuery.gte(column, value)
      } else if (operator === "lt") {
        nextQuery = nextQuery.lt(column, value)
      } else if (operator === "lte") {
        nextQuery = nextQuery.lte(column, value)
      } else if (operator === "like") {
        nextQuery = nextQuery.like(column, value)
      } else if (operator === "ilike") {
        nextQuery = nextQuery.ilike(column, value)
      } else if (operator === "in") {
        nextQuery = nextQuery.in(
          column,
          Array.isArray(value) ? value : []
        )
      } else if (operator === "is") {
        nextQuery = nextQuery.is(column, value)
      } else {
        nextQuery = nextQuery.eq(column, value)
      }

      return
    }

    nextQuery = nextQuery.eq(column, filterValue)
  })

  return nextQuery
}

function applySupabaseOrder(query, order) {
  if (!order) return query

  if (Array.isArray(order)) {
    return order.reduce((nextQuery, orderItem) => {
      if (!orderItem?.column) return nextQuery

      return nextQuery.order(orderItem.column, {
        ascending: orderItem.ascending !== false,
        nullsFirst: !!orderItem.nullsFirst,
        referencedTable: orderItem.referencedTable
      })
    }, query)
  }

  if (!order.column) return query

  return query.order(order.column, {
    ascending: order.ascending !== false,
    nullsFirst: !!order.nullsFirst,
    referencedTable: order.referencedTable
  })
}

/* =========================================================
   DIRECT SELECT
========================================================= */

async function runSupabaseSelect(table, options = {}) {
  let query = db
    .from(table)
    .select(options.select || "*")

  query = applySupabaseFilters(
    query,
    options.filters || {}
  )

  query = applySupabaseOrder(
    query,
    options.order || null
  )

  if (Number(options.limit || 0) > 0) {
    query = query.limit(Number(options.limit))
  }

  if (options.single) {
    query = query.single()
  } else if (options.maybeSingle) {
    query = query.maybeSingle()
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data
}

/* =========================================================
   CACHED SELECT
========================================================= */

async function cachedSupabaseSelect(table, options = {}) {
  const cacheEnabled = options.cache !== false
  const forceRefresh = options.forceRefresh === true
  const staleWhileRevalidate =
    options.staleWhileRevalidate === true

  const ttl = Number(
    options.ttl ?? SUPABASE_DEFAULT_CACHE_TTL
  )

  const cacheKey =
    options.cacheKey ||
    createSupabaseCacheKey(table, options)

  const cached = cacheEnabled
    ? readSupabaseCache(cacheKey, ttl)
    : {
        found: false,
        fresh: false,
        data: null
      }

  if (!forceRefresh && cached.found && cached.fresh) {
    return {
      data: cached.data,
      error: null,
      source: "cache",
      stale: false
    }
  }

  if (
    !forceRefresh &&
    staleWhileRevalidate &&
    cached.found
  ) {
    refreshSupabaseCacheInBackground(
      table,
      options,
      cacheKey
    )

    return {
      data: cached.data,
      error: null,
      source: "stale-cache",
      stale: true
    }
  }

  if (supabasePendingRequests.has(cacheKey)) {
    return supabasePendingRequests.get(cacheKey)
  }

  const requestPromise = (async () => {
    try {
      const data = await runSupabaseSelect(
        table,
        options
      )

      if (cacheEnabled) {
        writeSupabaseCache(cacheKey, data)
      }

      return {
        data,
        error: null,
        source: "network",
        stale: false
      }
    } catch (error) {
      console.log(
        `SUPABASE SELECT ERROR [${table}]:`,
        error
      )

      if (cached.found) {
        return {
          data: cached.data,
          error,
          source: "fallback-cache",
          stale: true
        }
      }

      return {
        data: options.single || options.maybeSingle
          ? null
          : [],
        error,
        source: "error",
        stale: false
      }
    } finally {
      supabasePendingRequests.delete(cacheKey)
    }
  })()

  supabasePendingRequests.set(
    cacheKey,
    requestPromise
  )

  return requestPromise
}

function refreshSupabaseCacheInBackground(
  table,
  options = {},
  cacheKey = null
) {
  const finalCacheKey =
    cacheKey ||
    options.cacheKey ||
    createSupabaseCacheKey(table, options)

  if (supabasePendingRequests.has(finalCacheKey)) {
    return supabasePendingRequests.get(finalCacheKey)
  }

  const requestPromise = (async () => {
    try {
      const data = await runSupabaseSelect(
        table,
        options
      )

      writeSupabaseCache(
        finalCacheKey,
        data
      )

      if (typeof options.onBackgroundUpdate === "function") {
        options.onBackgroundUpdate(data)
      }

      return {
        data,
        error: null,
        source: "background",
        stale: false
      }
    } catch (error) {
      console.log(
        `SUPABASE BACKGROUND REFRESH ERROR [${table}]:`,
        error
      )

      return {
        data: null,
        error,
        source: "background-error",
        stale: true
      }
    } finally {
      supabasePendingRequests.delete(finalCacheKey)
    }
  })()

  supabasePendingRequests.set(
    finalCacheKey,
    requestPromise
  )

  return requestPromise
}

/* =========================================================
   MODEL DATA WITH RELATIONS
========================================================= */

async function loadModelWithRelations(
  modelId,
  options = {}
) {
  const numericModelId = Number(modelId || 0)

  if (!numericModelId) {
    return {
      data: null,
      error: new Error("رقم النموذج غير صالح"),
      source: "validation"
    }
  }

  return cachedSupabaseSelect("models", {
    select: `
      id,
      name,
      segment_settings (
        segment,
        item_count
      ),
      visible_segments (
        segment_key,
        is_visible,
        sort_order
      )
    `,
    filters: {
      id: numericModelId
    },
    maybeSingle: true,
    cacheKey:
      `${SUPABASE_CACHE_PREFIX}model_relations:${numericModelId}`,
    ttl:
      options.ttl ??
      5 * 60 * 1000,
    forceRefresh:
      options.forceRefresh === true,
    staleWhileRevalidate:
      options.staleWhileRevalidate === true,
    onBackgroundUpdate:
      options.onBackgroundUpdate
  })
}

/* =========================================================
   CACHE INVALIDATION AFTER WRITES
========================================================= */

function clearSupabaseCacheByPrefix(prefix) {
  try {
    const keysToRemove = []

    for (
      let index = 0;
      index < localStorage.length;
      index++
    ) {
      const key = localStorage.key(index)

      if (
        key &&
        key.startsWith(
          SUPABASE_CACHE_PREFIX + prefix
        )
      ) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.log(
      "SUPABASE PREFIX CACHE CLEAR ERROR:",
      error
    )
  }
}

function getModelIdsFromPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload
      ? [payload]
      : []

  return [
    ...new Set(
      rows
        .map(row =>
          Number(
            row?.model ||
            row?.model_id ||
            0
          )
        )
        .filter(Boolean)
    )
  ]
}

function invalidateSupabaseWriteCache(
  table,
  payload = null
) {
  clearSupabaseTableCache(table)

  const modelRelatedTables = [
  "models",
  "segment_settings",
  "visible_segments",
  "global_segment_visibility",
  "questions",
  "top10_questions",
  "auction_questions",
  "who_images",
  "explain_words",
  "final_round_meta",
  "final_round1_items",
  "final_round2_items",
  "final_round3_items",
  "final_round4_items",
  "archive_boxes",
  "archive_items"
]

  if (
    modelRelatedTables.includes(table)
  ) {
    clearSupabaseTableCache("models")
    clearSupabaseTableCache(
      "segment_settings"
    )
    clearSupabaseTableCache(
      "visible_segments"
    )

    clearSupabaseCacheByPrefix(
      "model_relations:"
    )
  }

  const modelIds =
    getModelIdsFromPayload(payload)

  modelIds.forEach(modelId => {
    removeSupabaseCacheKey(
      `${SUPABASE_CACHE_PREFIX}model_relations:${modelId}`
    )
  })
}

/* =========================================================
   ORIGINAL CRUD FUNCTIONS
   متوافقة مع الأكواد الحالية
========================================================= */

async function saveData(table, data) {
  try {
    const { data: savedRows, error } = await db
      .from(table)
      .insert(data)
      .select()

    if (error) {
      throw error
    }

    invalidateSupabaseWriteCache(
      table,
      savedRows?.length
        ? savedRows
        : data
    )

    console.log("تم الحفظ")

    return {
      data: savedRows || [],
      error: null
    }
  } catch (error) {
    console.log(
      `SAVE DATA ERROR [${table}]:`,
      error
    )

    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast("خطأ في الحفظ")
    }

    return {
      data: [],
      error
    }
  }
}

async function loadData(
  table,
  options = {}
) {
  const result =
    await cachedSupabaseSelect(
      table,
      {
        select:
          options.select || "*",

        filters:
          options.filters || {},

        order:
          options.order || null,

        limit:
          options.limit || null,

        single:
          options.single || false,

        maybeSingle:
          options.maybeSingle || false,

        cache:
          options.cache !== false,

        ttl:
          options.ttl ??
          SUPABASE_DEFAULT_CACHE_TTL,

        forceRefresh:
          options.forceRefresh === true,

        staleWhileRevalidate:
          options.staleWhileRevalidate ===
          true,

        cacheKey:
          options.cacheKey,

        onBackgroundUpdate:
          options.onBackgroundUpdate
      }
    )

  return result.data
}

async function updateData(
  table,
  id,
  data
) {
  try {
    const {
      data: updatedRows,
      error
    } = await db
      .from(table)
      .update(data)
      .eq("id", id)
      .select()

    if (error) {
      throw error
    }

    invalidateSupabaseWriteCache(
      table,
      updatedRows?.length
        ? updatedRows
        : {
            id,
            ...data
          }
    )

    return {
      data: updatedRows || [],
      error: null
    }
  } catch (error) {
    console.log(
      `UPDATE DATA ERROR [${table}]:`,
      error
    )

    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast("خطأ في التعديل")
    }

    return {
      data: [],
      error
    }
  }
}

async function deleteData(
  table,
  id
) {
  try {
    const {
      data: deletedRows,
      error
    } = await db
      .from(table)
      .delete()
      .eq("id", id)
      .select()

    if (error) {
      throw error
    }

    invalidateSupabaseWriteCache(
      table,
      deletedRows || null
    )

    return {
      data: deletedRows || [],
      error: null
    }
  } catch (error) {
    console.log(
      `DELETE DATA ERROR [${table}]:`,
      error
    )

    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast("خطأ في الحذف")
    }

    return {
      data: [],
      error
    }
  }
}

async function upsertData(
  table,
  rows,
  options = {}
) {
  try {
    let query = db
      .from(table)
      .upsert(rows, {
        onConflict:
          options.onConflict,

        ignoreDuplicates:
          options.ignoreDuplicates ===
          true
      })

    if (
      options.returning !== false
    ) {
      query = query.select()
    }

    const {
      data,
      error
    } = await query

    if (error) {
      throw error
    }

    invalidateSupabaseWriteCache(
      table,
      data?.length
        ? data
        : rows
    )

    return {
      data: data || [],
      error: null
    }
  } catch (error) {
    console.log(
      `UPSERT DATA ERROR [${table}]:`,
      error
    )

    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast("خطأ في الحفظ")
    }

    return {
      data: [],
      error
    }
  }
}
/* =========================================================
   MANUAL CACHE INVALIDATION
========================================================= */

function invalidateModelCache(
  modelId = null
) {
  clearSupabaseTableCache("models")
  clearSupabaseTableCache(
    "segment_settings"
  )
  clearSupabaseTableCache(
    "visible_segments"
  )

  if (modelId) {
    removeSupabaseCacheKey(
      `${SUPABASE_CACHE_PREFIX}model_relations:${Number(modelId)}`
    )

    return
  }

  clearSupabaseCacheByPrefix(
    "model_relations:"
  )
}
/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.saveData =
  saveData

window.loadData =
  loadData

window.updateData =
  updateData

window.deleteData =
  deleteData

window.upsertData =
  upsertData

window.cachedSupabaseSelect =
  cachedSupabaseSelect

window.refreshSupabaseCacheInBackground =
  refreshSupabaseCacheInBackground

window.runSupabaseSelect =
  runSupabaseSelect

window.loadModelWithRelations =
  loadModelWithRelations

window.createSupabaseCacheKey =
  createSupabaseCacheKey

window.readSupabaseCache =
  readSupabaseCache

window.writeSupabaseCache =
  writeSupabaseCache

window.removeSupabaseCacheKey =
  removeSupabaseCacheKey

window.clearSupabaseTableCache =
  clearSupabaseTableCache

window.clearAllSupabaseCache =
  clearAllSupabaseCache

window.clearSupabaseCacheByPrefix =
  clearSupabaseCacheByPrefix

window.invalidateModelCache =
  invalidateModelCache

window.invalidateSupabaseWriteCache =
  invalidateSupabaseWriteCache