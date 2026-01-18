<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-6">Supabase Setup Verification</h1>

    <div v-if="loading" class="text-gray-600">Loading data...</div>
    <div v-else-if="error" class="text-red-500 bg-red-50 p-4 rounded">
      {{ error }}
    </div>

    <div v-else class="space-y-8">
      <section>
        <h2 class="text-xl font-semibold mb-4">Connection Status</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            :class="[
              'p-4 rounded border',
              doctors.length
                ? 'border-green-500 bg-green-50'
                : 'border-yellow-500 bg-yellow-50',
            ]"
          >
            <h3 class="font-medium">Doctors Table</h3>
            <p>{{ doctors.length }} records found</p>
          </div>
          <div
            :class="[
              'p-4 rounded border',
              patients.length
                ? 'border-green-500 bg-green-50'
                : 'border-yellow-500 bg-yellow-50',
            ]"
          >
            <h3 class="font-medium">Patients Table</h3>
            <p>{{ patients.length }} records found</p>
          </div>
          <div
            :class="[
              'p-4 rounded border',
              activities.length
                ? 'border-green-500 bg-green-50'
                : 'border-yellow-500 bg-yellow-50',
            ]"
          >
            <h3 class="font-medium">Activities Table</h3>
            <p>{{ activities.length }} records found</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-xl font-semibold mb-4">Data Preview</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="border rounded p-4">
            <h3 class="font-bold mb-2">Doctors</h3>
            <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto h-64">{{
              doctors
            }}</pre>
          </div>
          <div class="border rounded p-4">
            <h3 class="font-bold mb-2">Patients</h3>
            <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto h-64">{{
              patients
            }}</pre>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { dataService } from "../services/dataService";

const doctors = ref([]);
const patients = ref([]);
const activities = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const [docs, pats, acts] = await Promise.all([
      dataService.getDoctors(),
      dataService.getPatients(),
      dataService.getActivities(),
    ]);
    doctors.value = docs;
    patients.value = pats;
    activities.value = acts;
  } catch (err) {
    console.error(err);
    error.value =
      "Failed to fetch data. Check console for details. Ensure Supabase is connected and tables exist.";
  } finally {
    loading.value = false;
  }
});
</script>
