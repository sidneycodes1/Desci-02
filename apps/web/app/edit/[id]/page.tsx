'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { editorGuardRedirect } from '../../../lib/membership';
import { EditorDotsMenu } from '../../../components/editor/EditorDotsMenu';
import { InviteModal } from '../../../components/editor/InviteModal';

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const [projectId, setProjectId] = React.useState('');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');

  React.useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const { data, isLoading } = useQuery<{
    project: { id: string; name: string; owner_user_id: string } | null;
    userRole: 'admin' | 'owner' | 'member' | 'viewer';
  }>({
    queryKey: ['edit-guard', projectId],
    queryFn: async () => {
      if (!projectId) return { project: null, userRole: 'viewer' as const };
      const token = await getAccessToken();
      if (!token) return { project: null, userRole: 'viewer' as const };
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { project: null, userRole: 'viewer' as const };
      return res.json();
    },
    enabled: !!(projectId && authReady && authenticated),
  });

  const project = data?.project ?? null;
  const userRole = data?.userRole ?? 'viewer';
  const isAdmin = userRole === 'admin';

  const guard = React.useMemo(() => {
    if (!project) return null;
    return editorGuardRedirect(
      {
        ownerUserId: project.owner_user_id,
        appUserId: '',
        isCollaborator: userRole === 'member',
        isAdmin,
      },
      `/projects/${project.id}`
    );
  }, [project, userRole, isAdmin]);

  const canEdit =
    !project || userRole === 'owner' || userRole === 'member' || isAdmin || guard === null;

  if (!authReady || isLoading) {
    return <div className="p-8 text-[13px] text-[#6B6F76]">Loading editor</div>;
  }

  if (!authenticated) {
    return (
      <div className="p-8 rounded-[8px] border border-[#E4E2DC] bg-white text-center">
        <p className="text-[14px] font-medium text-[#16181D]">Log in to edit</p>
        <p className="text-[13px] text-[#6B6F76]">Reading is public. Editing needs an invite.</p>
        <Link href={`/projects/${projectId}`} className="text-[13px] text-[#1B2A4A] underline">
          Back to reading view
        </Link>
      </div>
    );
  }

  if (project && !canEdit) {
    return (
      <div className="p-8 rounded-[8px] border border-[#E4E2DC] bg-white text-center">
        <p className="text-[14px] font-medium text-[#16181D]">You are reading. Only the owner and invited collaborators can edit.</p>
        <Link href={`/projects/${project.id}`} className="text-[13px] text-[#1B2A4A] underline">
          Back to reading view
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 p-3 rounded-[8px] border border-[#E4E2DC] bg-white">
        <Link href={project ? `/projects/${project.id}` : '/'} className="text-[13px] text-[#6B6F76] hover:text-[#1B2A4A]">
          {project?.name ?? 'Draft'}
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setInviteOpen(true)} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
            Invite
          </button>
          <EditorDotsMenu onInvite={() => setInviteOpen(true)} />
          <Link href={project ? `/projects/${project.id}` : '/'} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
            Preview
          </Link>
          <button className="px-3 py-1.5 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E]">Publish</button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full px-4 py-3 rounded-[6px] border border-[#E4E2DC] bg-white text-[18px] font-semibold text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
        style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
      />
      <div className="flex items-center gap-1 p-2 rounded-[8px] border border-[#E4E2DC] bg-[#FAFAF8] text-[13px] text-[#6B6F76]">
        {['B', 'I', 'H', 'Link', 'Image', 'Code', 'Math', 'Quote', 'Attach'].map((t) => (
          <span key={t} className="px-2 py-1 rounded-[6px] hover:bg-white cursor-pointer border border-transparent hover:border-[#E4E2DC]">
            {t}
          </span>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={14}
        placeholder="Write your research here"
        className="w-full px-4 py-3 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
      />
      <p className="text-[12px] text-[#6B6F76]">Draft · Public · {body.split(/\s+/).filter(Boolean).length} words · Autosaved locally</p>

      {inviteOpen && (
        <InviteModal projectId={projectId} projectName={project?.name ?? 'project'} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
