import { supabase } from "../lib/supabaseClient";

export const authService = {
  async login(email, password) {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) throw authError;

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError) {
      console.error(
        "User found in Auth but not in public.users table",
        userError
      );
      throw new Error("User profile not found. Please contact administrator.");
    }

    return {
      user: authData.user,
      session: authData.session,
      role: userData.role,
      userDetails: userData,
    };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
};
