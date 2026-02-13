#!/bin/bash

# Configuration
RAM_DISK_SIZE="1G"
MOUNT_POINT="./tmp/hls"

# Create directory if it doesn't exist
if [ ! -d "$MOUNT_POINT" ]; then
    echo "Creating directory $MOUNT_POINT..."
    mkdir -p "$MOUNT_POINT"
fi

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    CYGWIN*)    machine=Cygwin;;
    MINGW*)     machine=MinGW;;
    MSYS*)      machine=MSYS;;
    *)          machine="UNKNOWN:${OS}"
esac

echo "Detected OS: $machine"

if [ "$machine" == "Linux" ]; then
    echo "Mounting tmpfs on Linux..."
    sudo mount -t tmpfs -o size=$RAM_DISK_SIZE tmpfs "$MOUNT_POINT"
    echo "Done. Verifying:"
    df -h "$MOUNT_POINT"
elif [ "$machine" == "Mac" ]; then
    echo "Mounting RAM disk on macOS..."
    # macOS requires hdid/diskutil
    RAM_DISK_SECTORS=$((1024 * 1024 * 1024 / 512)) # 1GB
    DISK_ID=$(hdiutil attach -nomount ram://$RAM_DISK_SECTORS)
    diskutil eraseVolume HFS+ "HLS_RAM_Disk" $DISK_ID
    mount -t hfs "$DISK_ID" "$MOUNT_POINT"
    echo "Done."
elif [[ "$machine" == "MinGW" || "$machine" == "MSYS" || "$machine" == "Cygwin" ]]; then
    echo "Detected Windows environment (Git Bash/MSYS)."
    echo "To create a RAM Disk on Windows, it is recommended to use ImDisk or a PowerShell script."
    echo ""
    echo "PowerShell Command (requires Administrator):"
    echo "New-PSDrive -Name 'R' -PSProvider FileSystem -Root '\\localhost\C$\Users\TempRAMDisk' -Persist"
    echo "(Note: Windows doesn't have native 'mount tmpfs' equivalent without 3rd party tools like ImDisk)"
else
    echo "Unsupported OS for automatic mounting: $machine"
fi
