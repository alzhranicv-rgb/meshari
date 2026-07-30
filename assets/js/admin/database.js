/* =========================================================
   DATABASE HELPERS
   Unified Supabase operations
========================================================= */

async function dbSelect(
  table,
  builder = null,
  options = {}
) {
  const {
    select = "*",
    fallback = [],
    logLabel = table,
    count = null,
    head = false
  } = options

  try {
    let query =
      db
        .from(table)
        .select(select, {
          count,
          head
        })

    if (typeof builder === "function") {
      query = builder(query)
    }

    const {
      data,
      error,
      count: rowCount
    } = await query

    if (error) {
      console.error(
        `[DB SELECT] ${logLabel}:`,
        error
      )

      return {
        ok: false,
        data: fallback,
        count: 0,
        error
      }
    }

    return {
      ok: true,
      data: data ?? fallback,
      count: rowCount ?? 0,
      error: null
    }
  } catch (error) {
    console.error(
      `[DB SELECT CATCH] ${logLabel}:`,
      error
    )

    return {
      ok: false,
      data: fallback,
      count: 0,
      error
    }
  }
}

function invalidateDatabaseCache(
  table,
  payload = null
) {
  if (
    typeof window.invalidateSupabaseWriteCache ===
    "function"
  ) {
    window.invalidateSupabaseWriteCache(
      table,
      payload
    )
  }
}

async function dbUpsert(
  table,
  rows,
  options = {}
) {
  const {
    onConflict = "",
    select = "",
    logLabel = table
  } = options

  try {
    let query =
      db
        .from(table)
        .upsert(
          rows,
          onConflict
            ? {
                onConflict
              }
            : undefined
        )

    if (select) {
      query = query.select(select)
    }

    const {
      data,
      error
    } = await query

    if (error) {
      console.error(
        `[DB UPSERT] ${logLabel}:`,
        error
      )

      return {
        ok: false,
        data: null,
        error
      }
    }

    invalidateDatabaseCache(
      table,
      data ?? rows
    )

    return {
      ok: true,
      data: data ?? null,
      error: null
    }
  } catch (error) {
    console.error(
      `[DB UPSERT CATCH] ${logLabel}:`,
      error
    )

    return {
      ok: false,
      data: null,
      error
    }
  }
}


async function dbInsert(
  table,
  rows,
  options = {}
) {
  const {
    select = "",
    single = false,
    logLabel = table
  } = options

  try {
    let query =
      db
        .from(table)
        .insert(rows)

    if (select) {
      query = query.select(select)
    }

    if (single) {
      query = query.single()
    }

    const {
      data,
      error
    } = await query

    if (error) {
      console.error(
        `[DB INSERT] ${logLabel}:`,
        error
      )

      return {
        ok: false,
        data: null,
        error
      }
    }

    invalidateDatabaseCache(
      table,
      data ?? rows
    )

    return {
      ok: true,
      data: data ?? null,
      error: null
    }
  } catch (error) {
    console.error(
      `[DB INSERT CATCH] ${logLabel}:`,
      error
    )

    return {
      ok: false,
      data: null,
      error
    }
  }
}

async function dbUpdate(
  table,
  values,
  builder = null,
  options = {}
) {
  const {
    select = "",
    logLabel = table
  } = options

  try {
    let query =
      db
        .from(table)
        .update(values)

    if (typeof builder === "function") {
      query = builder(query)
    }

    if (select) {
      query = query.select(select)
    }

    const {
      data,
      error
    } = await query

    if (error) {
      console.error(
        `[DB UPDATE] ${logLabel}:`,
        error
      )

      return {
        ok: false,
        data: null,
        error
      }
    }

    invalidateDatabaseCache(
      table,
      data ?? values
    )

    return {
      ok: true,
      data: data ?? null,
      error: null
    }
  } catch (error) {
    console.error(
      `[DB UPDATE CATCH] ${logLabel}:`,
      error
    )

    return {
      ok: false,
      data: null,
      error
    }
  }
}

async function dbDelete(
  table,
  builder = null,
  options = {}
) {
  const {
    select = "",
    fallback = [],
    logLabel = table
  } = options

  try {
    let query =
      db
        .from(table)
        .delete()

    if (typeof builder === "function") {
      query = builder(query)
    }

    if (select) {
      query = query.select(select)
    }

    const {
      data,
      error
    } = await query

    if (error) {
      console.error(
        `[DB DELETE] ${logLabel}:`,
        error
      )

      return {
        ok: false,
        data: fallback,
        error
      }
    }

    invalidateDatabaseCache(
      table,
      data ?? null
    )

    return {
      ok: true,
      data: data ?? fallback,
      error: null
    }

  } catch (error) {
    console.error(
      `[DB DELETE CATCH] ${logLabel}:`,
      error
    )

    return {
      ok: false,
      data: fallback,
      error
    }
  }
}

window.dbSelect =
  dbSelect

window.dbUpsert =
  dbUpsert

window.dbInsert =
  dbInsert

window.dbUpdate =
  dbUpdate

window.dbDelete =
  dbDelete

window.invalidateDatabaseCache =
  invalidateDatabaseCache