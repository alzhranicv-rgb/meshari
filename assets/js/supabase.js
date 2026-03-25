const SUPABASE_URL = "https://onwjghmlekuydehphkgy.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_k9IYD_5T8pr5Zy37nqXX_g_S0CZLlrK"

const db = supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
)

window.db = db

/* =========================
حفظ البيانات
========================= */

async function saveData(table,data){

const { error } = await db
.from(table)
.insert(data)

if(error){
console.log(error)
alert("خطأ في الحفظ")
}else{
console.log("تم الحفظ")
}

}



/* =========================
جلب البيانات
========================= */

async function loadData(table){

const { data,error } = await db
.from(table)
.select("*")

if(error){
console.log(error)
return []
}

return data

}



/* =========================
تحديث البيانات
========================= */

async function updateData(table,id,data){

const { error } = await db
.from(table)
.update(data)
.eq("id",id)

if(error){
console.log(error)
}

}



/* =========================
حذف البيانات
========================= */

async function deleteData(table,id){

const { error } = await db
.from(table)
.delete()
.eq("id",id)

if(error){
console.log(error)
}

}