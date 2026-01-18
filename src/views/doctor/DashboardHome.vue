<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { dataService } from "@/services/dataService.js";
import Loading from "@/components/common/Loading.vue";

// Import Icons
import PatientIcon from "@/assets/admin/patient.png"; // Fallback
import WaitingIcon from "@/assets/doctor/waiting-for-review.png";
import DoneIcon from "@/assets/doctor/done.png";
import AttentionIcon from "@/assets/doctor/need-attention.png";
import ImageStatsIcon from "@/assets/admin/image.png"; // Fallback

const router = useRouter();
const route = useRoute();

const currentFilter = ref("All");
const searchQuery = ref("");
const patients = ref([]);
const isLoading = ref(true);

watch(
  () => route.query.filter,
  (newFilter) => {
    if (newFilter) {
      currentFilter.value = newFilter;
    } else {
      currentFilter.value = "All";
    }
  },
  { immediate: true },
);

onMounted(async () => {
  try {
    isLoading.value = true;
    patients.value = await dataService.getPatients();
  } catch (error) {
    console.error("Failed to fetch patients:", error);
  } finally {
    isLoading.value = false;
  }
});

// Helper for Attention logic
const isAttentionCase = (p) => {
  const isPending =
    p.review === "PENDING" || p.review === "-" || p.review === "Not Yet";
  if (!isPending) return false;
  if (p.medical_records && p.medical_records.length > 0) {
    const latest = p.medical_records[p.medical_records.length - 1];
    if (latest && latest.ai_diagnosis) {
      const diag = JSON.stringify(latest.ai_diagnosis).toLowerCase();
      // "Malignant" usually implies attention needed if not validated yet?
      // Or maybe attention is needed if AI says Malignant but doctor hasn't reviewed
      return diag.includes("malignant");
    }
  }
  return false;
};

const stats = computed(() => {
  const total = patients.value.length;
  // Stats Calculation from client data
  const pendingCount = patients.value.filter(
    (p) => p.review === "PENDING" || p.review === "-" || p.review === "Not Yet",
  ).length;
  const doneCount = patients.value.filter(
    (p) => p.review === "VALIDATED" || p.review === "Done",
  ).length;
  const attentionCount = patients.value.filter(isAttentionCase).length;
  // Total Images (Patients with images)
  const totalImages = patients.value.filter((p) => p.image).length;

  return [
    {
      label: "Waiting For Review",
      value: pendingCount,
      icon: WaitingIcon,
    },
    {
      label: "Done",
      value: doneCount,
      icon: DoneIcon,
    },
    {
      label: "Total Images",
      value: totalImages,
      icon: ImageStatsIcon,
      isBlue: true,
    },
    {
      label: "Need Attention",
      value: attentionCount,
      icon: AttentionIcon,
    },
  ];
});

const filteredPatients = computed(() => {
  let result = patients.value;

  // 1. Text Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.id.toString().includes(q),
    );
  }

  // 2. Sidebar Filter
  const filter = currentFilter.value;
  if (filter === "All") return result;

  if (filter === "Not Yet") {
    return result.filter(
      (p) =>
        p.review === "PENDING" || p.review === "-" || p.review === "Not Yet",
    );
  }

  if (filter === "Done") {
    return result.filter(
      (p) => p.review === "VALIDATED" || p.review === "Done",
    );
  }

  if (filter === "Attention") {
    return result.filter(isAttentionCase);
  }

  return result;
});

// Presentation Helpers
const getAiAnalysisText = (p) => {
  // Return: Normal, Benign, Malignant
  if (p.medical_records && p.medical_records.length > 0) {
    const latest = p.medical_records[p.medical_records.length - 1];
    if (latest && latest.ai_diagnosis) {
      let d = "";
      try {
        const parsed =
          typeof latest.ai_diagnosis === "string"
            ? JSON.parse(latest.ai_diagnosis)
            : latest.ai_diagnosis;
        d = parsed.class || JSON.stringify(latest.ai_diagnosis);
      } catch (e) {
        d = String(latest.ai_diagnosis);
      }

      d = d.toLowerCase();
      if (d.includes("normal"))
        return { text: "Normal", class: "text-green-500 font-bold" };
      if (d.includes("benign"))
        return { text: "Benign", class: "text-[#0099ff] font-bold" };
      if (d.includes("malignant"))
        return { text: "Malignant", class: "text-red-500 font-bold" };
    }
  }
  return { text: "-", class: "text-gray-400" };
};

const getReviewStatus = (p) => {
  const isDone = p.review === "VALIDATED" || p.review === "Done";
  return isDone ? "Done" : "Pending";
};

const openReview = (patientId) => {
  router.push({ name: "review-console", params: { id: patientId } });
};
</script>

<template>
  <div class="container mx-auto">
    <!-- Header -->
    <div class="mb-10 text-center">
      <h2 class="text-2xl font-bold text-gray-800 hidden">Doctor Dashboard</h2>
      <p class="text-gray-500 text-lg">Welcome Dr Bachtiar!</p>
    </div>

    <!-- Stats Cards (White Cards with Borders) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-sm flex items-center justify-between h-24 relative overflow-hidden group hover:border-slate-300 transition-colors"
      >
        <div class="flex items-center gap-4 z-10">
          <img :src="stat.icon" class="w-10 h-10 object-contain" />
          <span
            class="text-xs font-bold text-gray-500"
            :class="{ 'text-[#0099ff]': stat.isBlue }"
            >{{ stat.label }}</span
          >
        </div>
        <div class="z-10 bg-transparent flex items-center">
          <span
            class="text-3xl font-bold text-gray-500 mr-2"
            :class="{ 'text-[#0099ff]': stat.isBlue }"
            >{{ stat.value }}</span
          >
        </div>
      </div>
    </div>

    <!-- Dashboard Title + Search -->
    <div
      class="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4"
    >
      <h2 class="text-3xl font-medium text-gray-700">Doctor dashboard</h2>

      <div class="relative w-full md:w-96">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search"
          class="w-full bg-gray-100 rounded-full py-3 pl-6 pr-12 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2.5"
          stroke="currentColor"
          class="w-5 h-5 absolute right-4 top-3.5 text-gray-500"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
    </div>

    <!-- Patient List (Card Rows) -->
    <div class="w-full">
      <!-- Table Head -->
      <div
        class="grid grid-cols-12 gap-4 px-8 py-2 text-gray-500 font-bold text-sm mb-2 uppercase tracking-wide opacity-70 hidden md:grid"
      >
        <div class="col-span-2">ID</div>
        <div class="col-span-2">Name</div>
        <div class="col-span-3 text-center">AI Analysis</div>
        <div class="col-span-2 text-center">Image</div>
        <div class="col-span-3 text-center">Review</div>
      </div>

      <div v-if="isLoading" class="flex justify-center py-12">
        <Loading text="Loading..." />
      </div>

      <div v-else class="space-y-4">
        <!-- Row Item -->
        <div
          v-for="patient in filteredPatients"
          :key="patient.id"
          class="bg-gray-100/80 rounded-2xl p-4 md:px-8 md:py-5 flex flex-col md:grid md:grid-cols-12 gap-4 items-center shadow-sm"
        >
          <!-- ID/Icon -->
          <div class="col-span-2 flex items-center gap-3 w-full justify-start">
            <div
              class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center p-1.5 shrink-0"
            >
              <img
                :src="PatientIcon"
                class="w-full h-full object-contain opacity-80"
              />
            </div>
            <span class="font-bold text-gray-600 truncate"
              >P00{{ patient.id }}</span
            >
          </div>

          <!-- Name -->
          <div class="col-span-2 w-full text-center md:text-left">
            <span
              class="font-bold text-gray-700 text-lg line-clamp-1"
              :title="patient.name"
              >{{ patient.name }}</span
            >
          </div>

          <!-- AI Analysis -->
          <div class="col-span-3 w-full flex justify-center">
            <span :class="getAiAnalysisText(patient).class">
              {{ getAiAnalysisText(patient).text }}
              <span
                v-if="getAiAnalysisText(patient).text === 'Malignant'"
                class="inline-block ml-1"
                >⚠️</span
              >
            </span>
          </div>

          <!-- Image Status -->
          <div class="col-span-2 w-full flex justify-center">
            <span v-if="patient.image" class="text-green-500 font-bold text-sm"
              >Yes</span
            >
            <span v-else class="text-gray-400 font-bold text-sm">No</span>
          </div>

          <!-- Review Action -->
          <div class="col-span-3 w-full flex justify-center">
            <button
              v-if="getReviewStatus(patient) === 'Pending'"
              @click="openReview(patient.id)"
              class="bg-white hover:bg-white text-gray-600 hover:text-gray-900 border border-gray-200 px-6 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all w-full md:w-auto"
            >
              Let's Review
            </button>
            <span v-else class="text-green-500 font-bold">Done</span>
          </div>
        </div>

        <div
          v-if="filteredPatients.length === 0"
          class="text-center py-12 text-gray-400"
        >
          No patients match your search.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No extra styles needed, using Tailwind */
</style>
