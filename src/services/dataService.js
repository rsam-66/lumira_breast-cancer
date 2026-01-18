import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseAdmin } from "../lib/supabaseClient";
import { getPublicImageUrl } from "./storageService";
import { aiService } from "./aiService";

const getAuthUidByEmail = async (email) => {
  if (!supabaseAdmin) return null;
  const {
    data: { users },
    error,
  } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error || !users) return null;
  const found = users.find((u) => u.email === email);
  console.log("Found auth user:", found?.id);
  return found ? found.id : null;
};

const createAuthUser = async (email, password, metadata) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const tempClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) throw error;
  return data;
};

const logActivity = async (actionType, description, userId = null) => {
  let uid = userId;
  if (!uid) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.user.email)
        .single();

      if (publicUser) {
        uid = publicUser.id;
      }
    }
  }

  if (uid) {
    await supabase.from("activity_logs").insert([
      {
        user_id: uid,
        action_type: actionType,
        description: description,
      },
    ]);
  }
};

export const dataService = {
  async getDoctors() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "doctor")
      .order("id", { ascending: true });

    if (error) throw error;
    return data;
  },

  async addDoctor(doctor) {
    const { password, ...doctorData } = doctor;

    if (password) {
      try {
        await createAuthUser(doctor.email, password, {
          name: doctor.name,
          role: "doctor",
          status: doctor.status || "Active",
        });
      } catch (authError) {
        console.error("Auth User Creation Failed:", authError);
        throw new Error(`Failed to create Auth account: ${authError.message}`);
      }
    }

    const { data, error } = await supabase
      .from("users")
      .insert([{ ...doctorData, role: "doctor" }])
      .select();

    if (error) throw error;

    await logActivity(
      "ADD_DOCTOR",
      `Added new doctor: ${doctor.name}`,
      data[0].id
    );

    return data[0];
  },

  async updateDoctor(id, updates) {
    const { password, ...updateData } = updates;

    if (supabaseAdmin) {
      try {
        const { data: currentDoctor } = await supabase
          .from("users")
          .select("email")
          .eq("id", id)
          .single();

        if (currentDoctor && currentDoctor.email) {
          const uid = await getAuthUidByEmail(currentDoctor.email);
          if (uid) {
            const authUpdates = {};
            if (updates.email && updates.email !== currentDoctor.email) {
              authUpdates.email = updates.email;
            }
            if (password && password.trim() !== "") {
              authUpdates.password = password;
            }
            if (updates.name || updates.status) {
              authUpdates.user_metadata = {};
              if (updates.name) authUpdates.user_metadata.name = updates.name;
              if (updates.status)
                authUpdates.user_metadata.status = updates.status;
            }

            if (Object.keys(authUpdates).length > 0) {
              console.log("Updating Auth User:", authUpdates);
              const { error: authError } =
                await supabaseAdmin.auth.admin.updateUserById(uid, authUpdates);
              if (authError) {
                console.error("Failed to update Auth user:", authError);
              }
            }
          } else {
            console.warn(
              "Auth UID not found for email:",
              currentDoctor.email,
              "- Skipping Auth Update"
            );
          }
        }
      } catch (e) {
        console.error("Error syncing with Supabase Auth:", e);
      }
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;

    await logActivity("UPDATE_DOCTOR", `Updated doctor with ID: ${id}`);

    return data[0];
  },

  async deleteDoctor(id) {
    if (supabaseAdmin) {
      try {
        const { data: currentDoctor } = await supabase
          .from("users")
          .select("email")
          .eq("id", id)
          .single();

        if (currentDoctor && currentDoctor.email) {
          const uid = await getAuthUidByEmail(currentDoctor.email);
          if (uid) {
            console.log("Deleting Auth User:", uid);
            const { error: authError } =
              await supabaseAdmin.auth.admin.deleteUser(uid);
            if (authError) {
              console.error("Failed to delete Auth user:", authError);
            }
          }
        }
      } catch (e) {
        console.error("Error deleting Supabase Auth user:", e);
      }
    }

    const { error: logError } = await supabase
      .from("activity_logs")
      .update({ user_id: null })
      .eq("user_id", id);

    if (logError) {
      console.error("Error unlinking activity logs:", logError);
      throw new Error("Failed to unlink activity logs before deleting doctor");
    }

    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) throw error;

    await logActivity("DELETE_DOCTOR", `Deleted doctor with ID: ${id}`);

    return true;
  },

  async getPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select(
        `
        *,
        medical_records (
          id,
          original_image_path,
          validation_status,
          doctor_diagnosis,
          ai_diagnosis,
          uploaded_at
        )
      `
      )
      .order("id", { ascending: true });

    if (error) throw error;

    return data.map((p) => {
      const latestRecord =
        p.medical_records && p.medical_records.length > 0
          ? p.medical_records[p.medical_records.length - 1]
          : null;

      let imageUrl = null;
      if (latestRecord && latestRecord.original_image_path) {
        imageUrl = getPublicImageUrl(
          latestRecord.original_image_path,
          "breast-cancer-images"
        );
      }

      return {
        ...p,
        image: imageUrl,
        review: latestRecord ? latestRecord.validation_status : "-",
      };
    });
  },

  async addPatient(patient) {
    const { name, email, phone, address } = patient;

    const { data, error } = await supabase
      .from("patients")
      .insert([{ name, email, phone, address }])
      .select();

    if (error) throw error;
    return data[0];
  },

  async updatePatient(id, updates) {
    const { name, email, phone, address } = updates;

    const { data, error } = await supabase
      .from("patients")
      .update({ name, email, phone, address })
      .eq("id", id)
      .select();

    if (error) throw error;

    await logActivity("UPDATE_PATIENT", `Updated patient with ID: ${id}`);

    return data[0];
  },

  async deletePatient(id) {
    const { error } = await supabase.from("patients").delete().eq("id", id);

    if (error) throw error;

    await logActivity("DELETE_PATIENT", `Deleted patient with ID: ${id}`);

    return true;
  },

  async getActivities() {
    const { data, error } = await supabase
      .from("activity_logs")
      .select(
        `
        *,
        users (name)
      `
      )
      .order("timestamp", { ascending: false })
      .limit(10);

    if (error) throw error;

    return data.map((log) => ({
      id: log.id,
      title: log.action_type,
      user: log.users?.name || "Unknown",
      time: new Date(log.timestamp).toLocaleTimeString(),
      iconColor: "bg-blue-100 text-blue-600",
    }));
  },

  async getDashboardStats() {
    let patientCount = 0;
    let doctorCount = 0;
    let imageCount = 0;
    let waitingCount = 0;

    try {
      const { count, error } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });
      if (error) console.error("Error fetching patient count:", error);
      else patientCount = count || 0;
    } catch (e) {
      console.error("Exception fetching patient count:", e);
    }

    try {
      const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "doctor");
      if (error) console.error("Error fetching doctor count:", error);
      else doctorCount = count || 0;
    } catch (e) {
      console.error("Exception fetching doctor count:", e);
    }

    try {
      const { count, error } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .not("original_image_path", "is", null);
      if (error) console.error("Error fetching image count:", error);
      else imageCount = count || 0;
    } catch (e) {
      console.error("Exception fetching image count:", e);
    }

    try {
      const { count, error } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .eq("validation_status", "PENDING");
      if (error) console.error("Error fetching waiting count:", error);
      else waitingCount = count || 0;
    } catch (e) {
      console.error("Exception fetching waiting count:", e);
    }

    return [
      {
        label: "Total Patient",
        value: patientCount,
        icon: "users",
        color: "blue",
      },
      {
        label: "Total Doctor",
        value: doctorCount,
        icon: "user-md",
        color: "green",
      },
      {
        label: "Image Uploaded",
        value: imageCount,
        icon: "image",
        color: "blue",
      },
      {
        label: "Waiting For Review",
        value: waitingCount,
        icon: "clock",
        color: "red",
      },
    ];
  },

  async getDoctorStats(doctorId) {
    let myPatientCount = 0;
    let pendingCount = 0;
    let completedCount = 0;
    let attentionCount = 0;

    try {
      // My Patients (Total)
      const { count: total, error: totalError } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });
      if (!totalError) myPatientCount = total || 0;

      // Pending (PENDING)
      // We count patients whose latest record is PENDING, or no record?
      // Approximate with record count for now as per previous step discussion,
      // or simplistic query. For sidebar stats, quick numbers are better.
      const { count: pending, error: pendingError } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .eq("validation_status", "PENDING");
      if (!pendingError) pendingCount = pending || 0;

      // Completed (VALIDATED only)
      const { count: validated, error: valError } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .eq("validation_status", "VALIDATED");
      if (!valError) completedCount = validated || 0;

      // Attention (REJECTED)
      const { count: rejected, error: rejError } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .eq("validation_status", "REJECTED");
      if (!rejError) attentionCount = rejected || 0;
    } catch (e) {
      console.error("Error fetching doctor stats:", e);
    }

    return {
      total: myPatientCount,
      pending: pendingCount,
      completed: completedCount,
      attention: attentionCount,
    };
  },

  async uploadMedicalRecord(patientId, file) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${patientId}_${Date.now()}.${fileExt}`;
    const filePath = `raw/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("breast-cancer-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Supabase Storage Upload Error:", uploadError);
      throw uploadError;
    }

    let aiDiagnosis = "Pending";
    let aiGradCamPath = null;

    try {
      const aiResult = await aiService.predict(file);
      aiDiagnosis = JSON.stringify(aiResult);

      if (aiResult.gradcam_path) {
        try {
          console.log(
            "Found GradCAM path in AI result:",
            aiResult.gradcam_path
          );
          const filename = aiResult.gradcam_path.split(/[\\/]/).pop();
          const encodedFilename = encodeURIComponent(filename);
          const gradCamUrl = `http://localhost:8000/gambar_api/${encodedFilename}`;
          console.log("Fetching GradCAM from:", gradCamUrl);

          const res = await fetch(gradCamUrl);
          if (!res.ok)
            throw new Error(`Failed to fetch GradCAM: ${res.statusText}`);
          const blob = await res.blob();
          console.log("Fetched GradCAM blob:", blob.size, blob.type);

          const gradCamStoragePath = `gradcam/${filename}`;
          const { error: gcUploadError } = await supabase.storage
            .from("breast-cancer-images")
            .upload(gradCamStoragePath, blob, {
              upsert: true,
              contentType: "image/png",
            });

          if (!gcUploadError) {
            console.log(
              "Successfully uploaded GradCAM to Supabase:",
              gradCamStoragePath
            );
            aiGradCamPath = gradCamStoragePath;
          } else {
            console.error("Supabase GradCAM Upload Error:", gcUploadError);
          }
        } catch (gcErr) {
          console.error("Failed to upload GradCAM to Supabase:", gcErr);
        }
      }

      const percentage = (aiResult.confidence * 100).toFixed(1);
      const readableDiagnosis = `${aiResult.class} (${percentage}%)`;

      await logActivity(
        "AI_ANALYSIS",
        `AI Analysis for patient ${patientId}: ${readableDiagnosis}`
      );
    } catch (aiError) {
      console.error("AI Service Failed, but image uploaded:", aiError);
      aiDiagnosis = "Analysis Failed";
    }

    const { data, error: dbError } = await supabase
      .from("medical_records")
      .insert([
        {
          patient_id: patientId,
          original_image_path: filePath,
          validation_status: "PENDING",
          uploaded_at: new Date().toISOString(),
          ai_diagnosis: aiDiagnosis,
          ai_gradcam_path: aiGradCamPath,
        },
      ])
      .select();

    if (dbError) throw dbError;

    await logActivity(
      "UPLOAD_IMAGE",
      `Uploaded medical record for patient ID: ${patientId}`
    );

    return data[0];
  },

  async logAIAnalysis(patientId, result = "Analysis Run") {
    await logActivity(
      "AI_ANALYSIS",
      `Performed AI Analysis for patient ID: ${patientId}. Result: ${result}`
    );
  },

  async changePassword(currentPassword, newPassword) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("not_authenticated");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("incorrect_password");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) throw updateError;

    await logActivity("CHANGE_PASSWORD", "User changed their password");

    return true;
  },

  async getPatientById(id) {
    const { data, error } = await supabase
      .from("patients")
      .select(
        `
        *,
        medical_records (
          id,
          original_image_path,
          validation_status,
          ai_diagnosis,
          doctor_diagnosis,
          doctor_notes,
          uploaded_at,
          ai_gradcam_path,
          doctor_brush_path
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    const latestRecord =
      data.medical_records && data.medical_records.length > 0
        ? data.medical_records[data.medical_records.length - 1]
        : null;

    let imageUrl = null;
    let aiGradCamUrl = null;
    let doctorBrushUrl = null;

    if (latestRecord) {
      if (latestRecord.original_image_path) {
        imageUrl = getPublicImageUrl(
          latestRecord.original_image_path,
          "breast-cancer-images"
        );
      }
      if (latestRecord.ai_gradcam_path) {
        aiGradCamUrl = getPublicImageUrl(
          latestRecord.ai_gradcam_path,
          "breast-cancer-images"
        );
      }
      if (latestRecord.doctor_brush_path) {
        doctorBrushUrl = getPublicImageUrl(
          latestRecord.doctor_brush_path,
          "breast-cancer-images"
        );
      }
    }

    return {
      ...data,
      image: imageUrl,
      aiGradCamImage: aiGradCamUrl,
      doctorBrushImage: doctorBrushUrl,
      latestRecord: latestRecord,
    };
  },

  async saveDoctorReview(originalRecordId, { agreement, note, heatmapImage }) {
    const { data: originalRecord, error: fetchError } = await supabase
      .from("medical_records")
      .select("*")
      .eq("id", originalRecordId)
      .single();

    if (fetchError) throw fetchError;

    let validatorId = null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.user.email)
        .single();
      if (user) validatorId = user.id;
    }

    let doctorBrushPath = null;

    if (heatmapImage) {
      try {
        const res = await fetch(heatmapImage);
        const blob = await res.blob();

        const fileName = `${
          originalRecord.patient_id
        }_review_${Date.now()}.png`;
        const filePath = `masks/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("breast-cancer-images")
          .upload(filePath, blob, { upsert: true });

        if (!uploadError) {
          doctorBrushPath = filePath;
        }
      } catch (e) {
        console.error("Failed to upload doctor mask:", e);
      }
    }

    const newRecord = {
      patient_id: originalRecord.patient_id,
      original_image_path: originalRecord.original_image_path,
      ai_diagnosis: originalRecord.ai_diagnosis,
      ai_gradcam_path: originalRecord.ai_gradcam_path,
      ai_confidence: originalRecord.ai_confidence,

      validator_id: validatorId,

      doctor_notes: note,
      doctor_brush_path: doctorBrushPath,
      validation_status: "VALIDATED",
      validated_at: new Date().toISOString(),
      is_ai_accurate: agreement === "agree",
      doctor_diagnosis:
        agreement === "agree" ? "Agreed with AI" : "Disagreed with AI",

      uploaded_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("medical_records")
      .insert([newRecord])
      .select();

    if (error) throw error;

    await logActivity(
      "DOCTOR_REVIEW",
      `Doctor submitted review (New Record) for patient ${originalRecord.patient_id}`
    );

    return data[0];
  },

  async reAnalyzePatient(patientId) {
    const patient = await this.getPatientById(patientId);
    if (!patient.latestRecord || !patient.latestRecord.original_image_path) {
      throw new Error("No image found for this patient.");
    }

    const imagePath = patient.latestRecord.original_image_path;

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("breast-cancer-images")
      .download(imagePath);

    if (downloadError) throw downloadError;

    const file = new File([fileBlob], imagePath.split("/").pop(), {
      type: fileBlob.type,
    });
    let aiDiagnosis = "Analysis Failed";
    let aiGradCamPath = null;

    try {
      const aiResult = await aiService.predict(file);
      aiDiagnosis = JSON.stringify(aiResult);

      if (aiResult.gradcam_path) {
        try {
          console.log(
            "Re-Analysis: Found GradCAM path in AI result:",
            aiResult.gradcam_path
          );
          const filename = aiResult.gradcam_path.split(/[\\/]/).pop();
          const encodedFilename = encodeURIComponent(filename);
          const gradCamUrl = `http://localhost:8000/gambar_api/${encodedFilename}`;
          console.log("Re-Analysis: Fetching GradCAM from:", gradCamUrl);
          const res = await fetch(gradCamUrl);
          if (!res.ok)
            throw new Error(`Failed to fetch GradCAM: ${res.statusText}`);
          const blob = await res.blob();
          console.log(
            "Re-Analysis: Fetched GradCAM blob:",
            blob.size,
            blob.type
          );

          const gradCamStoragePath = `gradcam/${filename}`;
          const { error: gcUploadError } = await supabase.storage
            .from("breast-cancer-images")
            .upload(gradCamStoragePath, blob, {
              upsert: true,
              contentType: "image/png",
            });

          if (!gcUploadError) {
            console.log(
              "Re-Analysis: Successfully uploaded GradCAM to Supabase:",
              gradCamStoragePath
            );
            aiGradCamPath = gradCamStoragePath;
          } else {
            console.error(
              "Re-Analysis: Supabase GradCAM Upload Error:",
              gcUploadError
            );
          }
        } catch (gcErr) {
          console.error("Re-Analysis: Failed to upload GradCAM:", gcErr);
        }
      }

      const percentage = (aiResult.confidence * 100).toFixed(1);
      const readableDiagnosis = `${aiResult.class} (${percentage}%)`;

      await logActivity(
        "AI_REANALYSIS",
        `AI Re-Analysis for patient ${patientId}: ${readableDiagnosis}`
      );
    } catch (aiError) {
      console.error("AI Re-Analysis Failed:", aiError);
      throw aiError;
    }

    const updates = {
      ai_diagnosis: aiDiagnosis,
      uploaded_at: new Date().toISOString(),
    };

    if (aiGradCamPath) {
      updates.ai_gradcam_path = aiGradCamPath;
    }

    const { data, error } = await supabase
      .from("medical_records")
      .update(updates)
      .eq("id", patient.latestRecord.id)
      .select();

    if (error) throw error;
    return data[0];
  },

  async getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .single();

    if (error) {
      console.error("Error fetching current user details:", error);
      return null;
    }
    return data;
  },
};
