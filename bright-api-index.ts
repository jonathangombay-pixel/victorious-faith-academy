import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  action?: "create" | "sync" | "delete";
  studentId?: string;
  password?: string;
  fullName?: string;
  studentDbId?: string;
  authUserId?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function internalEmail(studentId: string) {
  return `${studentId.toLowerCase().replace(/[^a-z0-9]/g, "")}@students.vfa.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Only POST requests are allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const token = authHeader.slice("Bearer ".length);
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid authentication token." }, 401);

    const callerId = userData.user.id;
    const { data: admin, error: adminError } = await adminClient
      .from("admin_profiles")
      .select("id, role")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    if (adminError) return json({ error: adminError.message }, 500);
    if (!admin) return json({ error: "You are not authorized to manage student accounts." }, 403);

    const body: Payload = await req.json();

    if (body.action === "delete") {
      if (!body.studentDbId && !body.authUserId) return json({ error: "Student account identifier is required." }, 400);

      let authUserId = body.authUserId || null;
      if (!authUserId && body.studentDbId) {
        const { data: student, error } = await adminClient
          .from("students").select("auth_user_id").eq("id", body.studentDbId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        authUserId = student?.auth_user_id || null;
      }

      if (authUserId) {
        const { error } = await adminClient.auth.admin.deleteUser(authUserId);
        if (error && !String(error.message || "").toLowerCase().includes("not found")) {
          return json({ error: error.message }, 400);
        }
      }
      return json({ success: true });
    }

    if (!body.studentDbId || !body.studentId || !body.fullName) {
      return json({ error: "Student ID, full name, and database ID are required." }, 400);
    }

    const { data: existing, error: lookupError } = await adminClient
      .from("students").select("auth_user_id").eq("id", body.studentDbId).maybeSingle();
    if (lookupError) return json({ error: lookupError.message }, 500);

    if (body.action === "create") {
      if (existing?.auth_user_id) {
        // Keep the existing Auth user and update only its internal email if the
        // alphabetical Student ID was reassigned. Never regenerate the password.
        const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
          existing.auth_user_id,
          { email: internalEmail(body.studentId), email_confirm: true },
        );
        if (updateAuthError) return json({ error: updateAuthError.message }, 400);
        return json({ success: true, studentAuthUserId: existing.auth_user_id, alreadyExists: true });
      }

      if (!body.password) return json({ error: "A password is required when creating a student account." }, 400);

      const { data: created, error: authError } = await adminClient.auth.admin.createUser({
        email: internalEmail(body.studentId),
        password: body.password,
        email_confirm: true,
        user_metadata: {
          portal_role: "student",
          student_code: body.studentId,
          full_name: body.fullName,
        },
      });
      if (authError) return json({ error: authError.message }, 400);

      const authUserId = created.user?.id;
      if (!authUserId) return json({ error: "No Auth user ID was returned." }, 500);

      const { error: updateError } = await adminClient
        .from("students").update({ auth_user_id: authUserId }).eq("id", body.studentDbId);
      if (updateError) {
        await adminClient.auth.admin.deleteUser(authUserId);
        return json({ error: updateError.message }, 500);
      }

      return json({ success: true, studentAuthUserId: authUserId });
    }

    if (body.action === "sync") {
      if (!body.authUserId) return json({ error: "Auth user ID is required for sync." }, 400);
      const { error } = await adminClient.auth.admin.updateUserById(body.authUserId, {
        email: internalEmail(body.studentId),
        email_confirm: true,
        user_metadata: { portal_role: "student", student_code: body.studentId, full_name: body.fullName },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, studentAuthUserId: body.authUserId });
    }

    return json({ error: "Invalid action." }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
