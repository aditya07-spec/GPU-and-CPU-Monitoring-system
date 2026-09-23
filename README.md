# GPU and CPU Monitoring System

A hardware monitoring project built in C to collect real time system and GPU telemetry on Windows.
For the GPU side i’m using NVIDIA NVML to get information from the GPU and for the system side i’m using Windows APIs to collect things like CPU and RAM usage. The data is then handled by a monitoring engine and later displayed through a frontend dashboard.
I started this project mainly because i wanted to understand how hardware monitoring software actually gets information from the system instead of just using monitoring apps without knowing what’s happening underneath.
Along the way Ive been learning C, Windows APIs, NVML and getting a better understanding of how GPUs and system hardware actually work together.

## Why I Built This

I started this project because i wanted to understand what’s actually going on inside a computer when we see stuff like GPU usage, VRAM usage, clock speeds, power consumption and other hardware stats.
Usually we just open something like Task Manager or another monitoring app and look at the numbers. I wanted to figure out how those numbers are actually being obtained in the first place.
So instead of just using existing monitoring software i wanted to build something myself and learn how a program can communicate with Windows and the GPU to get this information.
I also wanted to use this project to learn C and some computer fundamentals through an actual problem instead of just doing random small programs and exercises.
It started pretty simple with basic system monitoring then slowly turned into GPU telemetry, continuous monitoring, data collection and eventually a frontend dashboard.
Im planning to keep building on it as Ii learn more about computer architecture, GPUs, parallel processing, system programming and real time data visualization.

## What I Learned

This project taught me much more than just how to collect hardware readings. Most of the concepts i learned were introduced when i actually needed them for the project.

### 1-C Programming

I used this project to move from basic C programs toward a larger, multi part application.

Some of the concepts i worked with include:

Variables and data types
Functions
Loops and conditional logic
Pointers
Structures
Header files and libraries
Working with return values and error codes
File handling
Formatting and processing numerical data
Compiling and linking external libraries

### 2-Windows System Programming

I learned how a C program can interact with Windows instead of only working with its own variables and calculations.

This included working with Windows APIs to obtain system information such as CPU and memory-related data.

### 3-NVIDIA NVML

One of the biggest parts of the project was learning to use NVIDIA Management Library (NVML).

I learned how to:

Initialize and shut down NVML
Obtain a handle to the GPU
Retrieve GPU identification information
Read GPU utilization
Read VRAM usage
Read GPU temperature
Read GPU power usage
Read GPU core and memory clock speeds
Retrieve driver and CUDA information
Handle NVML return codes and errors

This helped me understand that hardware monitoring software is not simply reading a number. The program has to communicate with the appropriate system or hardware interface and correctly interpret the data it receives.

### 4-Monitoring and Data

I also learned how individual telemetry readings can be turned into a continuous monitoring system. Instead of obtaining one reading and stopping, the program repeatedly samples the system and can use those readings as monitoring data.

This led me toward concepts such as:
Sampling intervals
Monitoring loops
Telemetry snapshots
Data storage
CSV logging
Historical data
Statistics and peak detection

### 5-Frontend and Visualization

I also connected the monitoring side of the project with a simple web frontend using:
HTML
CSS
JavaScript
JSON

The frontend was developed with the help of AI. I used AI to help with the HTML, CSS, and JavaScript implementation because frontend development was not the main area i was focusing on while building the monitoring system
However the telemetry data structure and JSON setup were done by me. I decided what data the frontend needed to recieve and how the monitoring data should be represented. This gave me experience connecting a system level C program with a visual interface and understanding how hardware telemetry can be transformed into data that a frontend can display.

## How I Learned

I did not build this project by following one complete tutorial from start to finish

I learned the concepts as i needed them. When i reached a part of the project that i did not understand, i stopped, learned the relevant concept, experimented with it separately and then applied it to the project.

My learning process was roughly:

1. **Learn the basic concept**
   -Understand what the API, C feature or system concept actually does

2. **Experiment with it separately**
   -Write small pieces of code and test the behavior

3. **Apply it to the monitoring system**
   -Integrate the concept once i understood enough to use it

4. **Test and debug**
   -Run the program on my own system, inspect the output and investigate anything that did not behave as expected

5. **Repeat**
   -Each new part of the project introduced another concept that i had to learn

This approach made the project grow alongside my understanding of C, Windows system programming, GPU telemetry and computer architecture.

I also kept notes and experimented with different approaches instead of treating the code as something that simply had to work. The goal was to understand what the code was doing, why it was needed and what alternatives existed.

## AI Usage

AI was part of my development and learning process throughout this project.

I did not use AI with the goal of generating the entire project and submitting the result without understanding it. I mainly used it as a learning assistant, debugging partner, and research tool when i reached concepts or problems that i could not solve on my own.

### Where I Used AI

I used AI for:

-Explaining C concepts that i was still learning
-Breaking down unfamiliar Windows APIs and functions
-Understanding NVIDIA NVML and how its functions work
-Helping interpret compiler errors and runtime errors
-Discussing different approaches to implementing a feature
-Debugging problems when my own attempts were not working
-Explaining code so i could understand what it was doing
-Helping with the HTML, CSS, and JavaScript implementation of the frontend
-Researching unfamiliar concepts and terminology

### Where I Took Responsibility

I still had to decide what i wanted the project to do, what telemetry i wanted to collect, how the monitoring system should be structured and how the collected data should be represented.

I also tested the code on my own hardware and had to deal with problems that only appeared when actually running the program.
For example, when working with NVML, I encountered initialization and runtime errors that required investigating the API behavior, changing the implementation, testing again and verifying the resulting telemetry.
The frontend is an area where i relied more heavily on AI for implementation because my main learning focus was C, system programming, GPU telemetry, and computer architecture. The telemetry data and JSON structure used by the frontend were created and organized by me.

### Why I Used AI

I see AI as a tool that can shorten the distance between I don't know this yet and I can understand and use this concept.

Instead of spending hours stuck on an unfamiliar API or error. I could ask for an explanation, question the answer, test it myself and then decide whether the approach actually made sense.

For this project the important part was not avoiding AI completely. It was making sure that using AI did not replace the learning process


## System Architecture

The project is divided into a few main parts, with the C program acting as the core monitoring layer.

### Monitoring Layer

The C program communicates with the underlying system to collect hardware information.
For GPU telemetry, the project uses NVIDIA NVML. System level information is obtained through Windows APIs.
The monitoring program can repeatedly sample these values instead of collecting only a single reading.

### Data Layer

Collected readings can be stored as structured monitoring data.
The project uses CSV for monitoring data and JSON for the data consumed by the frontend.

### Frontend Layer

The frontend provides a visual representation of the collected telemetry using HTML, CSS and JavaScript.
The frontend is separate from the core C monitoring logic so that the monitoring layer and visualization layer can be developed independently.

## Current Features

### 1-GPU Telemetry

The current GPU monitoring implementation collects:

-GPU name
-GPU utilization
-GPU temperature
-VRAM usage
-Total VRAM
-Used VRAM
-Free VRAM
-VRAM utilization percentage
-GPU power usage
-GPU core clock
-GPU memory clock
-NVIDIA driver version
-CUDA driver version

### 2-System Telemetry

The project also includes system level monitoring such as:

-CPU usage
-RAM usage
-Memory statistics

### 3-Monitoring

The monitoring program supports continuous sampling of telemetry rather than collecting only a single reading.
The collected values can be used as the basis for historical monitoring and further analysis.

### 4-Frontend

A web based frontend is included for displaying monitoring information in a visual format.

## Technologies Used

C              :   Core monitoring program 
NVIDIA NVML    :   GPU telemetry
Windows API    :   System level telemetry 
HTML           :   Frontend structure
CSS            :   Frontend styling
JavaScript     :   Frontend logic and visualization
JSON           :   Telemetry data exchange
CSV            :   Monitoring data storage
Git / GitHub   :   Version control and project hosting

## Example Telemetry

Example readings from the system include values such as:

==========GPU & CPU Monitoring System==========
GPU Name                      : NVIDIA GeForce RTX 3050 Laptop GPU
Driver version                : 616.92 
Cuda Driver version           : 13040 
CPU Cores                     : 6

CPU Usage                     : 42.48%
Total Ram                     : 15.34 GiB
Available Ram                 : 7.35 GiB
Used Ram                      : 7.99 GiB
RAM Usage                     : 52.09%
Gpu Utlization                : 0%
Gpu Memory Utilization        : 0%
Gpu Temp                      : 52°C
Vram Usage                    : 3.27%
Total Vram                    : 4.00 GiB
Used Vram                     : 0.13 GiB
Free Vram                     : 3.87 GiB
Gpu Power                     : 12.77 W
Gpu Clock                     : 1500 MHz
Gpu Memory Clock              : 5486 MHz

These values are hardware dependent and will change depending on system state and workload.

## Current Status

The project is being developed incrementally.
The initial telemetry layer is functional, and the project is moving toward a more complete monitoring engine and visualization system.

### Completed / Working

-C based monitoring program
-GPU telemetry through NVML
-System level telemetry through Windows APIs
-Continuous monitoring
-GPU identification and information
-VRAM monitoring
-GPU power monitoring
-GPU clock monitoring
-Driver and CUDA information
-CSV data handling
-Initial frontend dashboard

### In Progress

-Statistical analysis
-Peak detection
-Further frontend development
-Better integration between monitoring and visualization

### Planned

- More detailed system telemetry
- More advanced visualization
- Additional GPU and system metrics
- Further experimentation with real time monitoring and graphics

## What I Want to Learn Next

This project is also a starting point for learning more about the lower level side of computers.

Some of the areas i want to explore further are:

-Computer architecture
-CPU and GPU architecture
-Parallel processing
-CUDA
-Real time graphics
-GPU performance analysis
-System programming
-Real time data visualization
-Hardware and software interaction

The project will continue to evolve as i learn these areas.

## Final Note

This project is both a working monitoring system and a learning project.

Some parts are more developed than others, and the architecture will continue to change as i learn more. I am intentionally keeping track of that process rather than presenting the project as something that was built perfectly from the beginning.

The main goal is to understand the systems underneath the tools i normally use, starting from C and hardware telemetry and gradually moving deeper into computer architecture, GPUs and real time systems.

**and yea used AI to help me writing this README**