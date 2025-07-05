import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Source ID is required." }, { status: 400 });
    }

    const deletedSource = await prisma.content_source.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Source deleted successfully",
      deletedSource 
    });
  } catch (error) {
    console.error("Failed to delete source:", error);
    
    // Handle case where source doesn't exist
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: "Source not found." }, { status: 404 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 