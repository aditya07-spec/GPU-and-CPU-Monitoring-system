#include <stdio.h>
#include <stdlib.h>
#include <Windows.h>
#include <nvml.h>
#define BYTES_TO_GIB (1.0 / (1024.0 * 1024.0 * 1024.0))
int main()
{
    system("chcp 65001 > nul");
    printf("\n==========GPU & CPU Monitoring System==========\n");
    DWORD bufferSize = 0;
    GetLogicalProcessorInformationEx(
        RelationProcessorCore,
        NULL,
        &bufferSize);
    void *buffer = malloc(bufferSize);
    if (buffer == NULL)
    {
        printf("MEMORY ALLOCATION FAILED!!\n");
        return 1;
    }
    BOOL status = GetLogicalProcessorInformationEx(
        RelationProcessorCore,
        buffer,
        &bufferSize);
    if (status == FALSE)
    {
        printf("FAILED TO GET PROCESSOR INFORMATION!!\n");
        free(buffer);
        return 1;
    }
    int coreCount = 0;
    BYTE *current = (BYTE *)buffer;
    BYTE *end = current + bufferSize;
    while (current < end)
    {
        SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX *info =
            (SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX *)current;
        if (info->Relationship == RelationProcessorCore)
        {
            coreCount++;
        }
        current += info->Size;
    }
    free(buffer);
    printf("%-30s: %d\n", "CPU Cores", coreCount);

    // CPU UTLIZATION PROGRAM

    FILETIME idleTime1, kernelTime1, userTime1;
    if (!GetSystemTimes(&idleTime1, &kernelTime1, &userTime1))
    {
        printf("GET SYSTEM TIMES FAILED\n");
        return 1;
    }

    unsigned long long combinedidleTimes1 = ((unsigned long long)idleTime1.dwHighDateTime << 32) | idleTime1.dwLowDateTime;
    unsigned long long combinedKernelTimes1 = ((unsigned long long)kernelTime1.dwHighDateTime << 32) | kernelTime1.dwLowDateTime;
    unsigned long long combinedUserTime1 = ((unsigned long long)userTime1.dwHighDateTime << 32) | userTime1.dwLowDateTime;

    int info_printed = 0;
    while (1)
    {

        Sleep(1000);

        FILETIME idleTime2, kernelTime2, userTime2;
        if (!GetSystemTimes(&idleTime2, &kernelTime2, &userTime2))
        {
            printf("GET SYSTEM TIMES FAILED\n");
            return 1;
        }

        unsigned long long combinedidleTimes2 = ((unsigned long long)idleTime2.dwHighDateTime << 32) | idleTime2.dwLowDateTime;
        unsigned long long combinedKernelTimes2 = ((unsigned long long)kernelTime2.dwHighDateTime << 32) | kernelTime2.dwLowDateTime;
        unsigned long long combinedUserTime2 = ((unsigned long long)userTime2.dwHighDateTime << 32) | userTime2.dwLowDateTime;

        unsigned long long idleTimeDiff = combinedidleTimes2 - combinedidleTimes1;
        unsigned long long kernelTimeDiff = combinedKernelTimes2 - combinedKernelTimes1;
        unsigned long long userTimeDiff = combinedUserTime2 - combinedUserTime1;

        unsigned long long totalTime = kernelTimeDiff + userTimeDiff;
        unsigned long long busy = totalTime - idleTimeDiff;
        double cpuusage = (double)busy / totalTime * 100.0;

        combinedidleTimes1 = combinedidleTimes2;
        combinedKernelTimes1 = combinedKernelTimes2;
        combinedUserTime1 = combinedUserTime2;

        // RAM MONITORIN PROGRAM

        MEMORYSTATUSEX memory;
        memory.dwLength = sizeof(memory);
        if (!GlobalMemoryStatusEx(&memory))
        {
            printf("GLOBAL MEMORY STATUS EX FAILED\n");
            return 1;
        }

        unsigned long long total_ram = memory.ullTotalPhys;
        unsigned long long available_ram = memory.ullAvailPhys;
        unsigned long long used_ram = total_ram - available_ram;
        double ram_usage = (double)used_ram / total_ram * 100;

        // GPU MONITORING SYSTEM

        nvmlReturn_t result;
        result = nvmlInit();
        if (result != NVML_SUCCESS)
        {
            printf("INITIALIZATION FAILED Error: %s\n", nvmlErrorString(result));
            return 1;
        }

        // DEVICE INITIALIZATION
        nvmlDevice_t my_gpu;
        nvmlReturn_t gpu_result;
        gpu_result = nvmlDeviceGetHandleByIndex(0, &my_gpu);
        if (gpu_result != NVML_SUCCESS)
        {
            printf("DEVICE INITIALIZATION FAILED Error: %s\n", nvmlErrorString(gpu_result));
            return 1;
        }

        // GET DEVICE NAME/DEVICE & CUDA DRIVER VERSION
        if (info_printed < 1)
        {
            nvmlReturn_t gpu_name_return;

            char gpu_name[100];
            gpu_name_return = nvmlDeviceGetName(my_gpu, gpu_name, 100);
            if (gpu_name_return != NVML_SUCCESS)
            {
                printf("GPU NAME FAILED Error: %s\n", nvmlErrorString(gpu_name_return));
                return 1;
            }
            nvmlReturn_t driver_ver_return;
            char driver_ver[20];
            driver_ver_return = nvmlSystemGetDriverVersion(driver_ver, 20);
            if (driver_ver_return != NVML_SUCCESS)
            {
                printf("DRIVER VERSION FAILED Error: %s\n", nvmlErrorString(driver_ver_return));
                return 1;
            }

            int cuda_driver_ver;
            nvmlReturn_t cuda_driver_ver_return;
            cuda_driver_ver_return = nvmlSystemGetCudaDriverVersion(&cuda_driver_ver);
            if (cuda_driver_ver_return != NVML_SUCCESS)
            {
                printf("CUDA DRIVER FAILED Error:%s\n", nvmlErrorString(cuda_driver_ver_return));
                return 1;
            }
            printf("%-30s: %s\n", "GPU Name", gpu_name);
            printf("%-30s: %s \n", "Driver version", driver_ver);
            printf("%-30s: %d \n", "Cuda Driver version", cuda_driver_ver);
            info_printed++;
        }

        // GET VRAM STATUS
        nvmlMemory_t gpu_vram;
        nvmlReturn_t gpu_vram_return;
        gpu_vram_return = nvmlDeviceGetMemoryInfo(my_gpu, &gpu_vram);
        if (gpu_vram_return != NVML_SUCCESS)
        {
            printf("GPU VRAM INITIALIZATION FAILED: %s\n", nvmlErrorString(gpu_vram_return));
            return 1;
        }
        double vram_usage = ((double)gpu_vram.used / gpu_vram.total) * 100;
        double total_vram_gb = gpu_vram.total * BYTES_TO_GIB;
        double used_vram_gb = gpu_vram.used * BYTES_TO_GIB;
        double free_vram_gb = gpu_vram.free * BYTES_TO_GIB;

        // GPU USAGE
        nvmlUtilization_t gpu_utilization;
        nvmlReturn_t gpu_utilization_return;
        gpu_utilization_return = nvmlDeviceGetUtilizationRates(my_gpu, &gpu_utilization);
        if (gpu_utilization_return != NVML_SUCCESS)
        {
            printf("GPU UTILIZATION FAILED Error: %s\n", nvmlErrorString(gpu_utilization_return));
            return 1;
        }

        // GPU TEMP
        nvmlTemperature_t gpu_temp;
        gpu_temp.version = nvmlTemperature_v1;
        gpu_temp.sensorType = NVML_TEMPERATURE_GPU;
        nvmlReturn_t gpu_temp_return;
        gpu_temp_return = nvmlDeviceGetTemperatureV(my_gpu, &gpu_temp);
        if (gpu_temp_return != NVML_SUCCESS)
        {
            printf("GPU TEMPERATURE FAILED Error: %s\n", nvmlErrorString(gpu_temp_return));
            return 1;
        }

        // GPU POWER

        unsigned int gpu_power;
        nvmlReturn_t gpu_power_return;
        gpu_power_return = nvmlDeviceGetPowerUsage(my_gpu, &gpu_power);
        if (gpu_power_return != NVML_SUCCESS)
        {
            printf("GPU POWER FAILED Error; %s\n", nvmlErrorString(gpu_power_return));
            return 1;
        }
        float powerwatts = gpu_power / 1000.0f;

        // GPU CLOCK

        unsigned int gpu_clock;
        nvmlReturn_t gpu_clock_return;
        gpu_clock_return = nvmlDeviceGetClockInfo(my_gpu, NVML_CLOCK_GRAPHICS, &gpu_clock);
        if (gpu_clock_return != NVML_SUCCESS)
        {
            printf("NVML GPU CLOCK FAILED Error: %s", nvmlErrorString(gpu_clock_return));
            return 1;
        }

        // GPU MEMORY CLOCK

        unsigned int gpu_mem_clock;
        nvmlReturn_t gpu_mem_clock_return;
        gpu_mem_clock_return = nvmlDeviceGetClockInfo(my_gpu, NVML_CLOCK_MEM, &gpu_mem_clock);
        if (gpu_mem_clock_return != NVML_SUCCESS)
        {
            printf("NVML GPU MEMORY CLOCK FAILED Error: %s", nvmlErrorString(gpu_mem_clock_return));
            return 1;
        }

        // printf("Total RAM (in bytes): %llu\n", total_ram);
        // printf("Available Ram (in bytes): %llu\n", available_ram);
        // printf("Used RAM:%llu\n", used_ram);

        printf("\n%-30s: %.2f%%\n", "CPU Usage", cpuusage);
        printf("%-30s: %.2f GiB\n", "Total Ram", total_ram * BYTES_TO_GIB);
        printf("%-30s: %.2f GiB\n", "Available Ram", available_ram * BYTES_TO_GIB);
        printf("%-30s: %.2f GiB\n", "Used Ram", used_ram * BYTES_TO_GIB);
        printf("%-30s: %.2f%%\n", "RAM Usage", ram_usage);
        printf("%-30s: %u%%\n", "Gpu Utlization", gpu_utilization.gpu);
        printf("%-30s: %u\n", "Gpu Memory Utilization", gpu_utilization.memory);
        printf("%-30s: %u°C\n", "Gpu Temp", gpu_temp.temperature);
        printf("%-30s: %.2f%%\n", "Vram Usage ", vram_usage);
        printf("%-30s: %.2f GiB\n", "Total Vram", total_vram_gb);
        printf("%-30s: %.2f GiB\n", "Used Vram", used_vram_gb);
        printf("%-30s: %.2f GiB\n", "Free Vram", free_vram_gb);
        printf("%-30s: %.2f W\n", "Gpu Power", powerwatts);
        printf("%-30s: %u MHz\n", "Gpu Clock", gpu_clock);
        printf("%-30s: %u MHz\n", "Gpu Memory Clock", gpu_mem_clock);

        nvmlShutdown();
    }

    return 0;
}