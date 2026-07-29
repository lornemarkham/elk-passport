"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/lib/data/local-repo";
import type { Adventure, AdventureDna, Moment, PlanInput } from "@/lib/schemas";

export function useAdventureDna() {
  return useQuery({
    queryKey: ["adventure-dna"],
    queryFn: repo.getAdventureDna,
  });
}

export function useSaveAdventureDna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dna: AdventureDna) => repo.saveAdventureDna(dna),
    onSuccess: (dna) => queryClient.setQueryData(["adventure-dna"], dna),
  });
}

export function useAdventures() {
  return useQuery({
    queryKey: ["adventures"],
    queryFn: repo.listAdventures,
  });
}

export function useAdventure(id: string | undefined) {
  return useQuery({
    queryKey: ["adventure", id],
    queryFn: () => repo.getAdventure(id as string),
    enabled: !!id,
  });
}

async function requestRecommendation(input: PlanInput) {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Could not curate a recommendation");
  return (await res.json()) as {
    title: string;
    tagline: string;
    blocks: { time: string; title: string; description: string }[];
  };
}

export function useCreateAdventure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanInput): Promise<Adventure> => {
      const recommendation = await requestRecommendation(input);
      const adventure: Adventure = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        intent: input.intent,
        constraints: input.constraints,
        recommendation,
        status: "planned",
        currentBlockIndex: 0,
        moments: [],
      };
      return repo.saveAdventure(adventure);
    },
    onSuccess: (adventure) => {
      queryClient.invalidateQueries({ queryKey: ["adventures"] });
      queryClient.setQueryData(["adventure", adventure.id], adventure);
    },
  });
}

export function useAddMoment(adventureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moment: Omit<Moment, "id" | "adventureId" | "createdAt">) =>
      repo.addMoment(adventureId, {
        ...moment,
        id: crypto.randomUUID(),
        adventureId,
        createdAt: new Date().toISOString(),
      }),
    onSuccess: (adventure) => {
      queryClient.setQueryData(["adventure", adventureId], adventure);
    },
  });
}

export function useAdvanceAdventure(adventureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (currentBlockIndex: number) =>
      repo.advanceAdventure(adventureId, currentBlockIndex),
    onSuccess: (adventure) => {
      queryClient.setQueryData(["adventure", adventureId], adventure);
      queryClient.invalidateQueries({ queryKey: ["adventures"] });
    },
  });
}

export function useCompleteAdventure(adventureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repo.completeAdventure(adventureId),
    onSuccess: (adventure) => {
      queryClient.setQueryData(["adventure", adventureId], adventure);
      queryClient.invalidateQueries({ queryKey: ["adventures"] });
    },
  });
}
