import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    
    // Validate required fields
    if (!userData.web3authUserId || !userData.walletAddress || !userData.loginProvider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize database connection
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Create or update user
    const user = await dao.createOrUpdateUser({
      web3authUserId: userData.web3authUserId,
      email: userData.email,
      name: userData.name,
      profileImage: userData.profileImage,
      loginProvider: userData.loginProvider,
      walletAddress: userData.walletAddress.toLowerCase(),
      isSocialLogin: userData.isSocialLogin || false
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        loginProvider: user.loginProvider,
        isSocialLogin: user.isSocialLogin
      }
    });

  } catch (error) {
    console.error('Error storing user auth data:', error);
    return NextResponse.json(
      { error: 'Failed to store user data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    const user = await dao.getUserByWallet(walletAddress.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: user.profileImage,
        walletAddress: user.walletAddress,
        loginProvider: user.loginProvider,
        isSocialLogin: user.isSocialLogin,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}