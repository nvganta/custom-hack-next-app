import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Topic ID is required." }, { status: 400 });
    }

    const deletedTopic = await prisma.topic.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Topic deleted successfully",
      deletedTopic 
    });
  } catch (error) {
    console.error("Failed to delete topic:", error);
    
    // Handle case where topic doesn't exist
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 