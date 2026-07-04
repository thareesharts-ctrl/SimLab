import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { NotFoundError } from '../utils/errors';
import { cacheService } from '../utils/caching';

export async function scoringRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/scoring/breakdown
   * Retrieves dimensional score breakdowns for each completed round
   */
  fastify.get('/breakdown', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const role = (user.role || 'INDIVIDUAL').toUpperCase().replace('-', '_');

    try {
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        return reply.status(200).send({
          success: true,
          hasScore: false,
          role,
          breakdown: {
            overall: 0,
            performance: 0,
            adaptability: 0,
            budgetDiscipline: 0,
            riskManagement: 0,
            roiEfficiency: 0,
            policyCompliance: 100
          },
          metrics: [],
          recommendations: [],
          nextAction: 'START_SANDBOX_SIMULATION',
          breakdowns: []
        });
      }

      if (role === 'INSTRUCTOR') {
        return reply.status(200).send({
          success: true,
          hasScore: false,
          role,
          message: 'Instructor account. Personal scoring is not applicable.',
          breakdown: {
            overall: 0,
            performance: 0,
            adaptability: 0,
            budgetDiscipline: 0,
            riskManagement: 0,
            roiEfficiency: 0,
            policyCompliance: 100
          },
          metrics: [],
          recommendations: [],
          breakdowns: []
        });
      }

      const sim = await prisma.simulationState.findFirst({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!sim) {
        return reply.status(200).send({
          success: true,
          hasScore: false,
          breakdown: {
            overall: 0,
            performance: 0,
            adaptability: 0,
            budgetDiscipline: 0,
            riskManagement: 0,
            roiEfficiency: 0,
            policyCompliance: 100
          },
          metrics: [],
          recommendations: [],
          nextAction: 'START_SANDBOX_SIMULATION',
          breakdowns: []
        });
      }

      const breakdowns = await prisma.scoreBreakdown.findMany({
        where: {
          simulationId: sim.id
        },
        orderBy: {
          round: 'asc'
        }
      });

      if (breakdowns.length === 0) {
        return reply.status(200).send({
          success: true,
          hasScore: false,
          status: 'IN_PROGRESS',
          message: 'Score will be available after the first simulation result is generated.',
          breakdown: {
            overall: 0,
            performance: 0,
            adaptability: 0,
            budgetDiscipline: 0,
            riskManagement: 0,
            roiEfficiency: 0,
            policyCompliance: 100
          },
          metrics: [],
          recommendations: [],
          breakdowns: []
        });
      }

      const latest = breakdowns[breakdowns.length - 1];

      return reply.status(200).send({
        success: true,
        hasScore: true,
        breakdown: {
          overall: latest?.compositeIndex ?? 0,
          performance: latest?.seoScore ?? 0,
          adaptability: latest?.adaptability ?? 0,
          budgetDiscipline: latest?.budgetDiscipline ?? 0,
          riskManagement: latest?.riskManagement ?? 0,
          roiEfficiency: latest?.efficiencyRoi ?? 0,
          policyCompliance: 100
        },
        metrics: [],
        recommendations: [],
        breakdowns
      });
    } catch (err: any) {
      return reply.status(200).send({
        success: true,
        hasScore: false,
        breakdown: {
          overall: 0,
          performance: 0,
          adaptability: 0,
          budgetDiscipline: 0,
          riskManagement: 0,
          roiEfficiency: 0,
          policyCompliance: 100
        },
        metrics: [],
        recommendations: [],
        nextAction: 'START_SANDBOX_SIMULATION',
        breakdowns: []
      });
    }
  });

  /**
   * GET /api/v1/scoring/leaderboard
   * Fetches the classmate leaderboard sorted descending by total score
   */
  fastify.get('/leaderboard', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;

    try {
      const sim = await prisma.simulationState.findFirst({
        where: {
          userId: authReq.user!.id,
        },
        include: {
          class: {
            include: {
              instructor: { select: { name: true } },
              scenario: { select: { maxRounds: true } }
            }
          },
          scoreBreakdowns: {
            orderBy: {
              round: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!sim) {
        return reply.status(200).send({
          success: true,
          classRank: 0,
          globalRank: 0,
          className: "No Active Cohort",
          instructorName: "Self-Guided",
          currentRound: 0,
          totalRounds: 10,
          classStats: {
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            medianScore: 0,
            participationRate: 0
          },
          leaderboard: [],
          recentAchievements: []
        });
      }

      const targetClassId = sim.classId;
      const cacheKey = `cache:leaderboard:${targetClassId || 'sandbox'}`;
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        return reply.status(200).send(cached);
      }

      const classSimulations = await prisma.simulationState.findMany({
        where: targetClassId ? { classId: targetClassId } : { userId: sim.userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          scoreBreakdowns: {
            orderBy: {
              round: 'desc'
            }
          }
        },
        orderBy: {
          score: 'desc'
        }
      });

      // Calculate Global Rank
      const globalCount = await prisma.simulationState.count({
        where: {
          score: {
            gt: sim.score
          }
        }
      });
      const globalRank = globalCount + 1;

      const classRank = classSimulations.findIndex(s => s.userId === authReq.user!.id) + 1;

      // To calculate previous ranks (rank movement)
      const latestRound = sim.scoreBreakdowns[0]?.round || 1;
      const prevRound = latestRound - 1;

      const prevScores = classSimulations.map(simState => {
        const pb = simState.scoreBreakdowns.find(b => b.round === prevRound);
        return {
          id: simState.id,
          score: pb ? pb.compositeIndex : 0
        };
      }).sort((a, b) => b.score - a.score);

      const leaderboard = classSimulations.map((s, index) => {
        const currentRank = index + 1;
        let movement = 0;
        let trend: 'up' | 'down' | 'stable' = 'stable';

        if (prevRound >= 1) {
          const pIndex = prevScores.findIndex(x => x.id === s.id);
          if (pIndex !== -1) {
            const prevRank = pIndex + 1;
            movement = prevRank - currentRank;
            trend = movement > 0 ? 'up' : movement < 0 ? 'down' : 'stable';
          }
        }

        const latestBreakdown = s.scoreBreakdowns[0] || null;
        const nextSim = classSimulations[index - 1] || null;
        const scoreDiff = nextSim ? parseFloat((nextSim.score - s.score).toFixed(1)) : 0;

        const compScore = latestBreakdown ? latestBreakdown.compositeIndex : s.score;
        let badge: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'None' = 'None';
        if (compScore >= 95) badge = 'Platinum';
        else if (compScore >= 90) badge = 'Gold';
        else if (compScore >= 80) badge = 'Silver';
        else if (compScore >= 70) badge = 'Bronze';

        const nameParts = s.user.name.split(' ');
        const avatarInitials = nameParts.map(p => p[0]).join('').toUpperCase().slice(0, 2);

        return {
          id: s.id,
          studentId: s.userId,
          name: s.user.name,
          avatar: avatarInitials,
          overallScore: s.score,
          compositeScore: compScore,
          roiScore: latestBreakdown ? latestBreakdown.efficiencyRoi : 0,
          adaptabilityScore: latestBreakdown ? latestBreakdown.adaptability : 0,
          seoScore: latestBreakdown ? latestBreakdown.seoScore : 0,
          googleAdsScore: latestBreakdown ? latestBreakdown.googleAdsScore : 0,
          metaAdsScore: latestBreakdown ? latestBreakdown.metaAdsScore : 0,
          roundsCompleted: s.scoreBreakdowns.length,
          performanceBadge: badge,
          rank: currentRank,
          previousRank: prevRound >= 1 ? currentRank + movement : currentRank,
          trend,
          movement: Math.abs(movement),
          scoreDiff
        };
      });

      // Compute Class Stats
      const scores = classSimulations.map(s => s.score);
      const totalCount = classSimulations.length;
      const averageScore = totalCount > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / totalCount).toFixed(1)) : 0;
      const highestScore = totalCount > 0 ? Math.max(...scores) : 0;
      const lowestScore = totalCount > 0 ? Math.min(...scores) : 0;

      // Median score
      const sortedScores = [...scores].sort((a, b) => a - b);
      let medianScore = 0;
      if (totalCount > 0) {
        const mid = Math.floor(totalCount / 2);
        medianScore = totalCount % 2 !== 0 ? sortedScores[mid] : parseFloat(((sortedScores[mid - 1] + sortedScores[mid]) / 2).toFixed(1));
      }

      // Participation rate
      const activeCount = classSimulations.filter(s => s.scoreBreakdowns.length > 0).length;
      const participationRate = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

      const classStats = {
        averageScore,
        highestScore,
        lowestScore,
        medianScore,
        participationRate
      };

      // Get Class Achievements Feed
      let achievements: any[] = [];
      if (targetClassId) {
        const recentAchievements = await prisma.notification.findMany({
          where: {
            type: 'achievement',
            user: { classId: targetClassId }
          },
          include: {
            user: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 8
        });

        const formatTimeAgo = (date: Date) => {
          const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
          let interval = Math.floor(seconds / 31536000);
          if (interval >= 1) return `${interval}y ago`;
          interval = Math.floor(seconds / 2592000);
          if (interval >= 1) return `${interval}mo ago`;
          interval = Math.floor(seconds / 86400);
          if (interval >= 1) return `${interval}d ago`;
          interval = Math.floor(seconds / 3600);
          if (interval >= 1) return `${interval}h ago`;
          interval = Math.floor(seconds / 60);
          if (interval >= 1) return `${interval}m ago`;
          return 'Just now';
        };

        achievements = recentAchievements.map(a => {
          const nameParts = a.user.name.split(' ');
          const initials = nameParts.map(p => p[0]).join('').toUpperCase().slice(0, 2);

          let badgeType: 'milestone' | 'streak' | 'perfect' | 'comeback' | 'first' = 'milestone';
          if (a.title.toLowerCase().includes('streak')) badgeType = 'streak';
          else if (a.title.toLowerCase().includes('seo') || a.title.toLowerCase().includes('ads')) badgeType = 'perfect';
          else if (a.title.toLowerCase().includes('comeback')) badgeType = 'comeback';
          else if (a.title.toLowerCase().includes('top') || a.title.toLowerCase().includes('first')) badgeType = 'first';

          return {
            studentName: a.user.name,
            achievement: a.title.replace('Achievement Unlocked: ', ''),
            description: a.message,
            timeAgo: formatTimeAgo(a.createdAt),
            avatar: initials,
            type: badgeType
          };
        });
      }

      const responsePayload = {
        success: true,
        classRank,
        globalRank,
        className: sim.class?.name || "Sandbox Mode",
        instructorName: sim.class?.instructor?.name || "Self-Paced",
        currentRound: sim.currentRound,
        totalRounds: sim.class?.scenario?.maxRounds || 10,
        classStats,
        leaderboard,
        recentAchievements: achievements
      };

      await cacheService.set(cacheKey, responsePayload, 300); // cache for 5 minutes

      return reply.status(200).send(responsePayload);
    } catch (err: any) {
      return reply.status(200).send({
        success: true,
        classRank: 0,
        globalRank: 0,
        className: "No Active Cohort",
        instructorName: "Self-Guided",
        currentRound: 0,
        totalRounds: 10,
        classStats: {
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          medianScore: 0,
          participationRate: 0
        },
        leaderboard: [],
        recentAchievements: []
      });
    }
  });

  /**
   * GET /api/v1/scoring/scorecard
   * Aggregates all round score breakdowns into a full scorecard with:
   * - cumulative averages per dimension
   * - round-by-round chart data
   * - performance band classification (Excellent / Good / Needs Improvement)
   */
  fastify.get('/scorecard', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;

    const sim = await prisma.simulationState.findFirst({
      where: {
        userId: authReq.user!.id,
        ...(authReq.user!.classId ? { classId: authReq.user!.classId } : {}),
      },
      include: {
        class: {
          include: {
            scenario: { select: { maxRounds: true, name: true, industry: true, targetKPI: true } }
          }
        },
        scoreBreakdowns: {
          orderBy: { round: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!sim) {
      return reply.status(200).send({
        success: true,
        scorecard: null,
        message: 'No simulation found.'
      });
    }

    const breakdowns = sim.scoreBreakdowns;
    const roundCount = breakdowns.length;

    const avg = (field: keyof typeof breakdowns[0]) => {
      if (roundCount === 0) return 0;
      const sum = breakdowns.reduce((acc: number, b: any) => acc + (b[field] as number || 0), 0);
      return parseFloat((sum / roundCount).toFixed(2));
    };

    const getPerformanceBand = (score: number): 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' => {
      if (score >= 90) return 'Excellent';
      if (score >= 75) return 'Good';
      if (score >= 55) return 'Average';
      return 'Needs Improvement';
    };

    const dimensions = {
      seoScore: avg('seoScore'),
      googleAdsScore: avg('googleAdsScore'),
      metaAdsScore: avg('metaAdsScore'),
      budgetScore: avg('budgetScore'),
      revenueScore: avg('revenueScore'),
      strategicAlignment: avg('strategicAlignment'),
      efficiencyRoi: avg('efficiencyRoi'),
      budgetDiscipline: avg('budgetDiscipline'),
      riskManagement: avg('riskManagement'),
      adaptability: avg('adaptability'),
    };

    const overallAverage = parseFloat(
      (Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.keys(dimensions).length).toFixed(2)
    );

    const scorecard = {
      simulationId: sim.id,
      studentId: sim.userId,
      scenarioName: sim.class?.scenario?.name || 'Sandbox',
      industry: sim.class?.scenario?.industry || 'Digital Marketing',
      targetKPI: sim.class?.scenario?.targetKPI || 'revenue',
      totalRounds: sim.class?.scenario?.maxRounds || 10,
      completedRounds: roundCount,
      isCompleted: sim.isCompleted,
      overallScore: sim.score,
      overallAverage,
      cumulativeRevenue: sim.cumulativeRevenue,
      cumulativeSpend: sim.cumulativeSpend,
      overallROI: sim.cumulativeSpend > 0
        ? parseFloat(((sim.cumulativeRevenue - sim.cumulativeSpend) / sim.cumulativeSpend * 100).toFixed(2))
        : 0,
      dimensions,
      dimensionBands: Object.fromEntries(
        Object.entries(dimensions).map(([key, val]) => [key, getPerformanceBand(val)])
      ),
      // Round-by-round chart data
      roundHistory: breakdowns.map((b: any) => ({
        round: b.round,
        compositeIndex: b.compositeIndex,
        seoScore: b.seoScore,
        googleAdsScore: b.googleAdsScore,
        metaAdsScore: b.metaAdsScore,
        budgetScore: b.budgetScore,
        revenueScore: b.revenueScore,
        strategicAlignment: b.strategicAlignment,
        efficiencyRoi: b.efficiencyRoi,
        budgetDiscipline: b.budgetDiscipline,
        riskManagement: b.riskManagement,
        adaptability: b.adaptability,
      })),
      // Overall performance band
      overallBand: getPerformanceBand(overallAverage),
    };

    return reply.status(200).send({
      success: true,
      scorecard
    });
  });

}
